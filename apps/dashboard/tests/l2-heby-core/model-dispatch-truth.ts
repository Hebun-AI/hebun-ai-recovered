/*
 * L2 — HEBY CORE v1. DISPATCH IS THE COMPOSITION, AND NOTHING ELSE MAY ANSWER IT.
 *
 * ── THE DEFECT THIS SUITE EXISTS TO KEEP OUT ─────────────────────────────────
 *
 * Two authorities decide whether Heby may ask a model anything:
 *
 *   the Director's durable connectivity control (R2E)  — a global row, read at request time
 *   `evaluateModelAvailability`                        — pure, server config + transport presence
 *
 * The request path applies BOTH, and applies the Director FIRST: `answerHebyModelRequest` reads
 * the control before a transport is even selected, and when it is off it returns the deterministic
 * answer with ZERO provider contact.
 *
 * `ProviderOpsView.availability` is only the second of those. It was nevertheless documented as
 * "the only field that answers may a request be attempted right now", rendered on the Platform
 * provider card under a footer saying exactly that, and read by the `/help` capability projection
 * as the answer for all eight `requiresModel` commands.
 *
 * So in the kill switch's OWN INTENDED OPERATING STATE — a fully configured deployment with the
 * Director's control off — the product said an attempt was permitted and the runtime dispatched
 * nothing. That combination is not an edge case; it is the only state the kill switch exists to
 * produce.
 *
 * `dispatch` is the composition, made ONCE by the projection that already holds both operands, in
 * the request path's own order. This suite pins that it is made there, that it is made correctly
 * across every representable combination, and that the two product surfaces read IT rather than
 * re-deriving an answer of their own.
 *
 * Pure: no database, no network, no provider, no secret.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  readProviderOpsView,
  type ModelDispatchState,
} from "../../src/features/heby-provider-ops/provider-connectivity-projection.server";
import type { ProviderOpsView } from "../../src/features/heby-provider-ops/provider-connectivity-projection.server";
import { readCommandCapabilityView } from "../../src/features/heby-commands/command-capability-projection.server";
import { HEBY_COMMANDS } from "../../src/features/heby-commands/registry";
import type { CapabilityAvailabilityView } from "../../src/features/integration-authority/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import type { ModelAvailabilityState } from "../../src/features/heby-runtime";

const TENANT = { tenantId: "tenant-l2", userId: "user-l2" } as unknown as TenantContext;
const NO_CAPABILITIES = { capabilities: [] } as unknown as CapabilityAvailabilityView;

/**
 * Environments that drive `evaluateModelAvailability` to each of its five states. These are REAL
 * configurations, not hand-written verdicts: the evaluator is left to classify them itself, so a
 * change to its rules surfaces here instead of being papered over by a literal.
 */
const CONFIGURED = {
  HEBUN_MODEL_CONNECTIVITY_ENABLED: "true",
  HEBUN_MODEL_PROVIDER: "claude",
  HEBUN_MODEL_ID: "claude-test-model",
  HEBUN_MODEL_MAX_OUTPUT_TOKENS: "300",
  HEBUN_MODEL_CREDENTIAL: "synthetic-presence-sentinel",
  /*
   * A DIFFERENT VARIABLE, ON PURPOSE. The view's `credential` field reports ANTHROPIC_API_KEY
   * presence while the availability GATE reads HEBUN_MODEL_CREDENTIAL — the divergence R2E
   * documented. Both are set here so this fixture is a genuinely complete deployment and the
   * Director's control is unambiguously the only thing left blocking it. A key-SHAPED sentinel;
   * never a real key.
   */
  ANTHROPIC_API_KEY: "sk-l2-SYNTHETIC-not-a-real-key",
} as const;

const ENVIRONMENTS: ReadonlyArray<{
  readonly expected: ModelAvailabilityState;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly transportPresent: boolean;
}> = [
  { expected: "AVAILABLE", env: CONFIGURED, transportPresent: true },
  { expected: "TRANSPORT_UNAVAILABLE", env: CONFIGURED, transportPresent: false },
  {
    expected: "CREDENTIAL_UNAVAILABLE",
    env: { ...CONFIGURED, HEBUN_MODEL_CREDENTIAL: undefined },
    transportPresent: true,
  },
  {
    expected: "MISCONFIGURED",
    env: { ...CONFIGURED, HEBUN_MODEL_ID: undefined },
    transportPresent: true,
  },
  {
    expected: "DISABLED",
    env: { ...CONFIGURED, HEBUN_MODEL_CONNECTIVITY_ENABLED: "false" },
    transportPresent: true,
  },
];

function opsFor(
  env: Readonly<Record<string, string | undefined>>,
  directorEnabled: boolean,
  transportPresent: boolean,
): Promise<ProviderOpsView> {
  return readProviderOpsView({
    env,
    resolveDirectorEnabled: async () => directorEnabled,
    /* Constructing nothing: presence is the only input the evaluator takes from a transport. */
    selectTransport: () =>
      transportPresent ? { transport: {} as never, transportProvenance: "fake" } : {},
  });
}

/**
 * The whole cross-product, asserted exhaustively.
 *
 * `permitted` must appear if and ONLY if the Director permits AND the configuration classifies
 * AVAILABLE. Deleting the Director operand from the composition makes the five Director-off rows
 * fail; deleting the availability operand makes the four blocked rows fail while the Director is on.
 */
async function dispatchIsTheComposition(): Promise<void> {
  const seen = new Set<ModelDispatchState>();

  for (const directorEnabled of [true, false]) {
    for (const scenario of ENVIRONMENTS) {
      const view = await opsFor(scenario.env, directorEnabled, scenario.transportPresent);
      const label = `director=${directorEnabled} availability=${scenario.expected}`;

      /* The availability field keeps its released meaning EXACTLY — the Director cannot move it. */
      assert.equal(
        view.availability,
        scenario.expected,
        `${label}: availability is the configuration classification and nothing else`,
      );
      assert.equal(view.directorEnabled, directorEnabled, `${label}: director permission is reported as given`);

      const expected: ModelDispatchState = !directorEnabled
        ? "blocked-by-director"
        : scenario.expected === "AVAILABLE"
          ? "permitted"
          : "blocked-by-availability";
      assert.equal(view.dispatch, expected, `${label}: dispatch`);
      seen.add(view.dispatch);
    }
  }

  /* All three states are actually reachable, so none of the branches above is dead. */
  assert.deepEqual(
    [...seen].sort(),
    ["blocked-by-availability", "blocked-by-director", "permitted"],
    "every dispatch state is reachable from a real configuration",
  );
}

/**
 * THE DIRECTOR OUTRANKS EVERYTHING BENEATH IT, INCLUDING A PERFECT CONFIGURATION.
 *
 * Stated separately from the cross-product because it is the specific state the defect lived in,
 * and it must be legible as its own claim rather than as one row of a table.
 */
async function directorOffIsNeverPermitted(): Promise<void> {
  for (const scenario of ENVIRONMENTS) {
    const view = await opsFor(scenario.env, false, scenario.transportPresent);
    assert.notEqual(view.dispatch, "permitted", "a request is never permitted while the Director's control is off");
    assert.equal(view.dispatch, "blocked-by-director", "and the refusing authority is named");
    assert.equal(view.directorControl, "disabled");
  }

  /* The exact reproduced state: everything configured, transport present, Director off. */
  const configuredButOff = await opsFor(CONFIGURED, false, true);
  assert.equal(configuredButOff.availability, "AVAILABLE");
  assert.equal(configuredButOff.configuration, "configured");
  assert.equal(configuredButOff.credential, "present");
  assert.equal(configuredButOff.transport, "fake");
  assert.equal(
    configuredButOff.dispatch,
    "blocked-by-director",
    "the kill switch's own intended operating state is never rendered as permitted",
  );
}

/**
 * `/help` — NO MODEL-REQUIRING COMMAND MAY READ AS AVAILABLE WHILE THE DIRECTOR SAYS NO.
 *
 * The eight `requiresModel` commands are asserted by DERIVING the list from the registry rather
 * than naming them, so a ninth advisory command cannot be added outside this guard.
 */
async function helpNeverOffersWhatTheDirectorRefused(): Promise<void> {
  const modelCommands = HEBY_COMMANDS.filter((command) => command.requiresModel === true);
  assert.ok(modelCommands.length > 0, "the registry declares model-requiring commands");

  const ops = await opsFor(CONFIGURED, false, true);
  assert.equal(ops.dispatch, "blocked-by-director");

  const view = await readCommandCapabilityView(TENANT, {
    readProviderOps: async () => ops,
    readCapabilityAvailability: async () => NO_CAPABILITIES,
  });

  for (const command of modelCommands) {
    const entry = view.entries.find((candidate) => candidate.commandId === command.id);
    assert.ok(entry, `${command.slash} is resolved`);
    assert.equal(entry!.state, "unavailable", `${command.slash} is not offered while the Director's control is off`);
    assert.equal(entry!.governedBy, "model-availability");
    /* The denial names the authority that made it — not the deployment's configuration. */
    assert.match(
      entry!.reason,
      /Director's connectivity control is off/,
      `${command.slash} names the refusing authority`,
    );
  }

  /* And with the Director permitting, the SAME configuration offers them — so this is not a constant. */
  const permitting = await opsFor(CONFIGURED, true, true);
  assert.equal(permitting.dispatch, "permitted");
  const offered = await readCommandCapabilityView(TENANT, {
    readProviderOps: async () => permitting,
    readCapabilityAvailability: async () => NO_CAPABILITIES,
  });
  for (const command of modelCommands) {
    const entry = offered.entries.find((candidate) => candidate.commandId === command.id);
    assert.equal(entry!.state, "available", `${command.slash} is offered when dispatch is permitted`);
  }
}

/**
 * NO SECOND ANSWER TO ONE QUESTION.
 *
 * Both product surfaces must READ the composed field. If either re-derives a verdict from
 * `availability` alone, the two can disagree — which is the defect returning by another door. The
 * assertions are scoped to the reading files, and the projection is where the composition is made.
 */
function onlyTheProjectionComposes(): void {
  const projection = readFileSync(
    "src/features/heby-provider-ops/provider-connectivity-projection.server.ts",
    "utf8",
  );
  assert.match(
    projection,
    /const dispatch: ModelDispatchState = !directorEnabled/,
    "the composition is made in the projection that already holds both operands",
  );

  /* The capability projection reads `dispatch` and no longer branches on `availability`. */
  const capability = readFileSync(
    "src/features/heby-commands/command-capability-projection.server.ts",
    "utf8",
  );
  assert.match(capability, /ops\.dispatch === "permitted"/, "the /help projection reads the composed field");
  assert.ok(
    !/ops\.availability\s*===/.test(capability),
    "the /help projection never re-derives a verdict from availability alone",
  );

  /* The card's verdict pill and its footer sentence both come from `dispatch`. */
  const card = readFileSync(
    "src/components/platform-providers/provider-connectivity-control-card.tsx",
    "utf8",
  );
  assert.match(card, /DISPATCH_LABEL\[view\.dispatch\]/, "the card renders the composed verdict");
  assert.ok(
    !/Availability<\/strong> is the only one that decides/.test(card),
    "the card no longer claims availability decides dispatch",
  );
  assert.match(
    card,
    /Dispatch<\/strong> is the only one that decides/,
    "the card names dispatch as the deciding field",
  );
}

/**
 * THE COMPOSED ORDER IS THE RUNTIME'S ORDER.
 *
 * A composition in the request path's order is only truthful while that IS the order. Asserted on
 * the orchestration function's own body — not module-wide, where the import block would match the
 * Director symbol first and make the claim impossible to falsify.
 */
function theRuntimeChecksTheDirectorFirst(): void {
  const source = readFileSync("src/features/heby-answer/model-answer.server.ts", "utf8");
  const start = source.indexOf("const directorEnabled = await");
  assert.ok(start > 0, "the orchestration reads the Director control");
  const transport = source.indexOf("selectTransport ?? selectModelTransport", start);
  assert.ok(
    transport > start,
    "the Director control is read BEFORE a transport is selected, so it is the first gate",
  );
  /* And the refusal branch dispatches nothing: transport selection sits inside the enabled branch. */
  const refusal = source.indexOf("if (!directorEnabled)", start);
  assert.ok(refusal > start && refusal < transport, "the refusal short-circuits before transport selection");
}

async function main(): Promise<void> {
  await dispatchIsTheComposition();
  await directorOffIsNeverPermitted();
  await helpNeverOffersWhatTheDirectorRefused();
  onlyTheProjectionComposes();
  theRuntimeChecksTheDirectorFirst();
  console.log("l2 heby core — model dispatch truth checks passed");
}

void main();
