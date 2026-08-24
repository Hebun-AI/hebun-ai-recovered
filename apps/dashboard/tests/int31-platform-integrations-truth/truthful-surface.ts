/*
 * INT-3.1 — Platform → Integrations tells the truth about real connections.
 *
 * ── THE DEFECT THIS SUITE EXISTS TO MAKE UNREPEATABLE ───────────────────────
 *
 * A real, verified Google connection existed in the deployment while `/integrations` said
 * "No integration connected" and "None. No integration is authenticated or connected." Not a
 * rendering bug: the page's only source of connection truth was the OFFLINE SIMULATION descriptor
 * catalog, which is structurally incapable of knowing what a tenant connected. The page could not
 * have been right by accident.
 *
 * ── FIVE FAILURE MODES, EACH ASSERTED AND EACH BITTEN ───────────────────────
 *
 *   1  a real connected integration is hidden
 *   2  a descriptor is rendered as connected
 *   3  the page claims "none connected" while a connected integration exists
 *   4  a secret-bearing field becomes reachable from the page model
 *   5  a consumer Gmail connection is labelled a verified Workspace domain connection
 *
 * Every check below is a FUNCTION over a model, so the bite harness at the bottom can hand each one
 * a deliberately corrupted model and require it to throw. An assertion nobody has watched fail is a
 * sentence, not a guard.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

import { getIntegrationsModel } from "../../src/features/platform-integrations";
import type { IntegrationsModel } from "../../src/features/platform-integrations";
import { IntegrationsSurface } from "../../src/components/platform-integrations/integrations-surface";
import { connectedFixture, connectionFixture } from "../helpers/integration-connection-fixtures";

const SRC = (...p: string[]) => join(process.cwd(), "src", ...p);
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const importsOf = (src: string) => [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);

const render = (model: IntegrationsModel) => renderToStaticMarkup(IntegrationsSurface({ model }));

/* ── The models under test ──────────────────────────────────────────────────── */

const CONNECTED = getIntegrationsModel({ status: "read", connections: [connectedFixture()] });
const EMPTY = getIntegrationsModel({ status: "read", connections: [] });
const NO_TENANT = getIntegrationsModel({ status: "unavailable", reason: "no-authorized-tenant-context" });

/*
 * ── A SECOND PROVIDER, SHAPED LIKE THE ROW THAT ACTUALLY EXISTS ─────────────
 *
 * Field for field, this is the GitHub connection in the production deployment: the verified
 * `Hebun-AI` organization, installation `156248772`, and the two permissions GitHub itself
 * reported. It exists here because every sentence on this page was written when Google was the
 * only provider, and a second one is the only thing that can prove they were written about a
 * PROVIDER rather than about connections in general.
 */
const GITHUB_CONNECTION = {
  integrationId: "829fe3d5-4a99-40bf-a50c-ebc00eb88cfb",
  name: "GitHub",
  providerKey: "github-organization",
  connectionState: "connected",
  health: "healthy",
  scopes: Object.freeze(["metadata:read", "pull_requests:read"]),
  externalAccountId: "156248772",
  externalAccountLabel: "Hebun-AI",
  lastVerifiedAt: "2026-08-24T16:47:15.300Z",
  lastSuccessAt: "2026-08-24T16:47:15.300Z",
  lastErrorAt: null,
  failureReason: null,
  revokedAt: null,
  createdAt: "2026-08-24T13:55:06.850Z",
} as const;

const GITHUB_AVAILABILITY = {
  readiness: "catalog-ready",
  capabilities: [
    {
      capability: "github.repository.activity.read",
      state: "available",
      reason: null,
      sources: [
        {
          integrationId: GITHUB_CONNECTION.integrationId,
          providerKey: GITHUB_CONNECTION.providerKey,
          accountLabel: GITHUB_CONNECTION.externalAccountLabel,
          lastVerifiedAt: GITHUB_CONNECTION.lastVerifiedAt,
          readAvailable: true,
          writeCapable: false,
        },
      ],
    },
  ],
} as const;

const GITHUB_CONNECTED = getIntegrationsModel(
  { status: "read", connections: [GITHUB_CONNECTION] } as Parameters<typeof getIntegrationsModel>[0],
  GITHUB_AVAILABILITY as unknown as Parameters<typeof getIntegrationsModel>[1],
);

/* ── 1 · A real connected integration may never be hidden ───────────────────── */

function connectedIntegrationIsVisible(model: IntegrationsModel): void {
  assert.equal(model.connected.length, 1, "the connected authority row reaches the model");
  const [row] = model.connected;
  assert.equal(row.connectionState, "connected", "it is rendered as connected");
  assert.equal(row.providerLabel, "Google Workspace", "the provider label comes from the definition authority");
  assert.equal(row.accountLabel, "someone@gmail.com", "the verified account label is carried");
  assert.ok(row.lastVerifiedAt, "the last verified time is carried");
  assert.equal(row.scopeCount, 3, "the observed scope count is carried");
  assert.ok(row.healthUsable, "healthy is reported as usable");

  const html = render(model);
  assert.ok(html.includes("someone@gmail.com"), "the account label is actually on the page");
  assert.ok(html.includes("Google Workspace"), "the provider label is actually on the page");
  assert.ok(/Connected/.test(html), "the page states the connection");
  for (const scope of row.scopes) {
    assert.ok(html.includes(scope), `the observed scope ${scope} is on the page`);
  }
}

/**
 * A NON-connected authority row must not vanish either. Rendering only connected rows would answer
 * "nothing here" for a tenant holding an expired grant — an omission that reads like an absence.
 */
function nonConnectedAuthorityRowsAreNotDropped(): void {
  const model = getIntegrationsModel({
    status: "read",
    connections: [connectionFixture({ connectionState: "expired", integrationId: "22222222-2222-4222-8222-222222222222" })],
  });
  assert.equal(model.connected.length, 0, "an expired row is not counted as connected");
  assert.equal(model.recordedNotConnected.length, 1, "an expired row is still surfaced");
  const html = render(model);
  assert.ok(/Recorded, not connected/.test(html), "the page names the non-connected record");
  assert.ok(html.includes("expired"), "the page states its actual state");
}

/* ── 2 · A descriptor may never be rendered as connected ────────────────────── */

function descriptorsAreNeverConnected(model: IntegrationsModel): void {
  assert.ok(model.candidates.length >= 1, "offline descriptors are still shown");
  for (const c of model.candidates) {
    assert.ok(!/^connected$/i.test(c.connectionState), `${c.name} does not claim connected`);
    /*
     * STRUCTURAL, not editorial: a descriptor has no field in which a connection fact could be
     * stated. A filter can be widened by a later edit; a missing property cannot be rendered.
     */
    for (const forbidden of ["health", "scopes", "accountLabel", "lastVerifiedAt", "verifiedDomain"]) {
      assert.ok(!(forbidden in c), `descriptor ${c.name} carries no connection field (${forbidden})`);
    }
  }
  /* The connected list is built from the authority listing alone — descriptors cannot enter it. */
  for (const row of model.connected) {
    assert.ok(
      !model.candidates.some((c) => c.name === row.providerLabel),
      `${row.providerLabel} in the connected list is an authority row, not a descriptor`,
    );
  }
}

function descriptorSectionDoesNotImplyConnection(): void {
  const html = render(EMPTY);
  assert.ok(/Available \/ offline descriptors/.test(html), "descriptors have their own heading");
  assert.ok(/A descriptor is not a connection/.test(html), "the page says what a descriptor is not");
}

/* ── 3 · "None connected" may never coexist with a connection ───────────────── */

function noneClaimTracksTheAuthority(model: IntegrationsModel): void {
  assert.equal(model.state.provenance, "integration-authority", "the banner names its source");
  assert.equal(model.state.connectedCount, model.connected.length, "the count cannot disagree with the list");

  const html = render(model);
  if (model.connected.length > 0) {
    assert.ok(!/no integration connected/i.test(model.state.headline), "no false headline");
    assert.ok(!/no integration connected/i.test(html), "no false headline on the page");
    assert.ok(
      !/None\.\s*(The connection authority reports no|No integration)/i.test(html),
      "no false empty-state sentence on the page",
    );
    assert.ok(
      !/no integration is authenticated or connected/i.test(html),
      "the retired Phase 24C claim cannot reappear",
    );
  } else {
    assert.ok(/no integration connected/i.test(model.state.headline), "an empty listing says so");
  }
}

/**
 * "Read, and it was empty" and "could not be read" are different facts, and only the first is a
 * statement that nothing is connected. Collapsing them would let an unreachable authority render as
 * a confident denial.
 */
function unreadableAuthorityIsNotADenial(): void {
  assert.equal(NO_TENANT.readiness, "no-tenant-context", "the readiness names why");
  assert.ok(!/no integration connected/i.test(NO_TENANT.state.headline), "unavailable is not a denial");
  assert.ok(/unavailable/i.test(NO_TENANT.state.headline), "the banner says unavailable");
  assert.ok(
    /not a statement that nothing is connected/i.test(NO_TENANT.state.note),
    "the note refuses to be read as a denial",
  );
  const html = render(NO_TENANT);
  assert.ok(/Not readable/.test(html), "the page says it could not read, not that nothing exists");
}

/* ── 4 · No secret-bearing field is reachable from the page model ───────────── */

/*
 * ── WHY THIS IS A KEY-AND-VALUE TEST, NOT A WORD BAN ────────────────────────
 *
 * The first version of this guard searched `JSON.stringify(model)` for the word "credential" and
 * failed immediately — on the model's own HONEST PROSE. The distinction "A stored credential is not
 * a connection" and the descriptor field `credentialStatus: "placeholder"` both contain the word,
 * and both are the surface telling the truth. A guard that forbids the vocabulary forbids the
 * explanation along with the leak, and the next phase learns to delete the sentence.
 *
 * So the question is asked precisely: does a FIELD carrying secret material exist, and does a VALUE
 * that looks like secret material appear? Prose may say whatever is true.
 */
const SECRET_FIELD_NAMES =
  /^(ciphertext|iv|auth_?tag|key_?id|algorithm|access_?token|refresh_?token|client_?secret|id_?token|token|secret|vault|password|expires_?at)$/i;

/**
 * `credentialStatus` is a DESCRIPTOR field from the offline simulation catalog whose only value is
 * a status word ("placeholder"). It is named here explicitly, with its allowed values pinned, so
 * that the exemption is a decision a reader can see rather than a hole in a regex.
 */
const DESCRIPTOR_STATUS_VALUES = new Set(["placeholder", "none", "unset", "not-configured"]);

/** Shapes that are secret material regardless of the field they arrive in. */
const SECRET_VALUE_SHAPES: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: "Google access token", pattern: /\bya29\.[A-Za-z0-9._-]+/ },
  { label: "Google refresh token", pattern: /\b1\/\/[A-Za-z0-9._-]{10,}/ },
  { label: "PEM block", pattern: /-----BEGIN [A-Z ]+-----/ },
  { label: "JWT", pattern: /\beyJ[A-Za-z0-9._-]{20,}/ },
  { label: "opaque blob", pattern: /"[A-Za-z0-9+/]{60,}={0,2}"/ },
];

/** Every key in the object graph, with the path that reached it. */
function keyPaths(value: unknown, path = "$"): Array<{ key: string; path: string; value: unknown }> {
  if (Array.isArray(value)) {
    return value.flatMap((entry, i) => keyPaths(entry, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) => [
      { key, path: `${path}.${key}`, value: entry },
      ...keyPaths(entry, `${path}.${key}`),
    ]);
  }
  return [];
}

function modelCarriesNoSecret(model: IntegrationsModel): void {
  for (const { key, path, value } of keyPaths(model)) {
    if (key === "credentialStatus") {
      assert.ok(
        typeof value === "string" && DESCRIPTOR_STATUS_VALUES.has(value),
        `${path} is a descriptor status word, never a credential (${String(value)})`,
      );
      continue;
    }
    assert.ok(!SECRET_FIELD_NAMES.test(key), `the page model carries no secret-bearing field (${path})`);
  }

  const json = JSON.stringify(model);
  for (const shape of SECRET_VALUE_SHAPES) {
    assert.ok(!shape.pattern.test(json), `no ${shape.label} appears in the page model`);
  }

  /*
   * Google's `sub`. Not a secret, but a stable cross-service identifier with no reason to be on a
   * screen — the account LABEL is what a human needs to recognise their own connection.
   */
  assert.ok(!json.includes("114884615390589849256"), "the external account subject id is not carried");
  for (const row of model.connected) {
    assert.ok(!("externalAccountId" in row), "no subject id field exists to render");
    assert.ok(
      !Object.keys(row).some((k) => /credential|token|secret|cipher|vault/i.test(k)),
      "no credential-shaped field exists on a connected row",
    );
  }

  const html = render(model);
  assert.ok(!html.includes("114884615390589849256"), "the subject id is not on the page");
  for (const shape of SECRET_VALUE_SHAPES) {
    assert.ok(!shape.pattern.test(html), `no ${shape.label} is rendered`);
  }
}

/**
 * THE BOUNDARY IS AN IMPORT GRAPH FACT, NOT A NAMING CONVENTION.
 *
 * The Platform feature module and its component may not reach the credential authority at all, and
 * the pure model may not reach a `.server` module — a surface that could see a secret would
 * eventually render one, and one that could fetch would become a second connection authority.
 */
function theCredentialAuthorityIsUnreachable(): void {
  const featureDir = SRC("features", "platform-integrations");
  const files = readdirSync(featureDir).filter((f) => f.endsWith(".ts"));
  assert.ok(files.length >= 3, "the feature module was found");

  for (const file of files) {
    const source = readFileSync(join(featureDir, file), "utf8");
    for (const target of importsOf(source)) {
      assert.ok(
        !/integration-credentials/.test(target),
        `platform-integrations/${file} cannot reach the credential authority (${target})`,
      );
      assert.ok(
        !/\.server(\b|"|\/)/.test(target),
        `platform-integrations/${file} performs no server I/O (${target})`,
      );
      assert.ok(!/\/mock(\b|"|\/)/.test(target), `platform-integrations/${file} imports no mock (${target})`);
    }
  }

  const component = readFileSync(SRC("components", "platform-integrations", "integrations-surface.tsx"), "utf8");
  for (const target of importsOf(component)) {
    assert.ok(!/integration-credentials/.test(target), `the surface cannot reach the credential authority (${target})`);
    assert.ok(!/\.server(\b|"|\/)/.test(target), `the surface performs no server I/O (${target})`);
  }

  /* Read-only stays read-only: no control could start, end or re-authorize a connection here. */
  const code = stripComments(component);
  for (const banned of ["<button", "onClick", "onSubmit", "<input", "<form", 'type="password"', "contentEditable"]) {
    assert.ok(!code.includes(banned), `the surface exposes no control or secret field (${banned})`);
  }
}

/**
 * The page performs the authorized read and hands it over. It reads the connection authority and
 * NOT the credential authority, and it holds no provider transport.
 */
function thePageReadsTheAuthorityAndNothingElse(): void {
  const page = readFileSync(
    join(process.cwd(), "src", "app", "(dashboard)", "integrations", "page.tsx"),
    "utf8",
  );
  const targets = importsOf(page);
  assert.ok(
    targets.some((t) => t.includes("integration-authority/integration-repository.server")),
    "the page reads the connection authority",
  );
  assert.ok(
    !targets.some((t) => /integration-credentials/.test(t)),
    "the page cannot reach the credential authority",
  );
  assert.ok(
    !targets.some((t) => /provider-google\/google-transport/.test(t)),
    "the page contacts no provider",
  );
  assert.ok(
    !targets.some((t) => /features\/provider-matrix/.test(t)),
    "the page derives no connection claim from the simulation catalog",
  );
  const code = stripComments(page);
  assert.ok(code.includes("listConnections"), "the read is the authority's own bounded listing");
}

/* ── 5 · A consumer Gmail account is never a verified Workspace domain ──────── */

/*
 * ── THE CLAIM, NOT THE PHRASE ───────────────────────────────────────────────
 *
 * The first version of this list banned the PHRASE "verified Workspace domain" and failed on the
 * surface's own DENIAL — "No verified Google Workspace domain was recorded for this connection, so
 * none is claimed." The sentence that removes the false claim necessarily contains the words the
 * false claim is made of. A guard that cannot tell an assertion from its negation forces the
 * product to stop explaining itself, which is a worse outcome than the defect.
 *
 * The negative lookbehind is what makes it a test of the CLAIM: "no verified Workspace domain"
 * passes, "a verified Workspace domain" does not.
 */
const WORKSPACE_CLAIMS: readonly RegExp[] = [
  /(?<!no )verified\s+(google\s+)?workspace\s+domain/i,
  /workspace\s+domain\s+verified/i,
  /(?<!not )domain[- ]verified/i,
];

function consumerAccountIsNotLabelledWorkspace(model: IntegrationsModel): void {
  for (const row of model.connected) {
    if (row.verifiedDomain === null) {
      for (const claim of WORKSPACE_CLAIMS) {
        assert.ok(
          !claim.test(row.accountKindStatement),
          `no verified-Workspace claim without a recorded domain (${claim})`,
        );
      }
      assert.ok(
        /google account/i.test(row.accountKindStatement),
        "an account with no recorded domain is called a Google Account",
      );
      assert.ok(
        /no verified google workspace domain was recorded/i.test(row.accountKindStatement),
        "the absence is stated, not left to inference",
      );
    }
  }
  const html = render(model);
  if (model.connected.every((r) => r.verifiedDomain === null)) {
    for (const claim of WORKSPACE_CLAIMS) {
      assert.ok(!claim.test(html), `the page makes no verified-Workspace claim (${claim})`);
    }
  }
}

/**
 * THE DOMAIN IS NOT INFERRED FROM THE EMAIL ADDRESS, AND THAT IS PROVED WITH A CUSTOM-DOMAIN
 * ADDRESS.
 *
 * `someone@acme.com` may be a Workspace account or a consumer account on a custom address; Hebun
 * cannot tell them apart from the label. A surface that split on the address would print
 * "verified Workspace domain" on a guess, which is exactly the mislabelling this guards.
 */
function aCustomDomainAddressStillClaimsNothing(): void {
  const model = getIntegrationsModel({
    status: "read",
    connections: [connectedFixture({ externalAccountLabel: "someone@acme.com" })],
  });
  const [row] = model.connected;
  assert.equal(row.verifiedDomain, null, "no domain is derived from the address");
  assert.ok(/google account/i.test(row.accountKindStatement), "it is still only a Google Account");
  for (const claim of WORKSPACE_CLAIMS) {
    assert.ok(!claim.test(render(model)), "a custom-domain address makes no Workspace claim");
  }
}

/**
 * WHY `verifiedDomain` IS ALWAYS NULL TODAY, MEASURED RATHER THAN ASSERTED IN PROSE.
 *
 * Google's `hd` claim is observed by the transport and stored in NO column. The day a phase adds
 * one, this assertion fails and points at itself — which is what keeps the limitation from expiring
 * silently in a comment.
 */
function theHostedDomainIsNotPersisted(): void {
  const schemaDir = SRC("db", "schema");
  const schema = readdirSync(schemaDir)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => readFileSync(join(schemaDir, f), "utf8"))
    .join("\n");
  assert.ok(
    !/hosted_?domain/i.test(schema),
    "no column stores a hosted domain, so no surface may claim one",
  );
  const authorityContracts = readFileSync(SRC("features", "integration-authority", "contracts.ts"), "utf8");
  assert.ok(
    !/hostedDomain/.test(authorityContracts),
    "the connection view carries no hosted domain, so the surface never receives one",
  );
}

/* ── The truthful-capability statement ──────────────────────────────────────── */

/**
 * The capability sentence is DERIVED from the catalog definition, so it cannot become a stale
 * reassurance. `google-workspace` defines no capability scopes, so the honest statement is that
 * this connection grants no data capability at all.
 */
function capabilityStatementIsTruthful(model: IntegrationsModel): void {
  for (const row of model.connected) {
    assert.ok(/identity verification only/i.test(row.capabilityStatement), "identity-only is stated");
    for (const overclaim of [/drive access/i, /calendar access/i, /can read your/i, /full access/i]) {
      assert.ok(!overclaim.test(row.capabilityStatement), `no capability is overclaimed (${overclaim})`);
    }
  }
  const html = render(model);
  assert.ok(
    !/\b(send|write|modify|delete)\b[^<]{0,40}\b(drive|calendar|gmail|directory)\b/i.test(html),
    "no write capability is implied anywhere on the page",
  );
}

/**
 * ── 6 · A SECOND PROVIDER IS DESCRIBED AS ITSELF, NEVER AS THE FIRST ────────
 *
 * The defect this exists to make unrepeatable was live in production: a verified GitHub
 * organization rendered as "Google Account. No verified Google Workspace domain was recorded for
 * this connection", and its granted capability rendered as "Read-only file discovery and metadata.
 * Hebun reads no file content, and holds no permission to change anything in Drive."
 *
 * Neither sentence was a typo. Both were provider-blind claims about ACCESS, printed as facts about
 * an organization on a page whose entire purpose is that a connection claim is never a guess.
 *
 * The guard is written as "no other provider's vocabulary may appear", not as "this exact string
 * must appear", so rewording the GitHub sentences keeps it passing while borrowing Google's again
 * fails it.
 */
function aSecondProviderIsNotDescribedAsTheFirst(model: IntegrationsModel): void {
  assert.equal(model.connected.length, 1, "the GitHub authority row reaches the model");
  const [row] = model.connected;

  assert.equal(row.providerLabel, "GitHub", "the provider label comes from the definition authority");
  assert.equal(row.accountLabel, "Hebun-AI", "the verified organization label is carried");

  /* Google's vocabulary, on a GitHub row. Every one of these was rendered before the fix. */
  const GOOGLE_WORDS = [/google/i, /workspace/i, /\bdrive\b/i, /gmail/i, /\bfile content\b/i];
  for (const word of GOOGLE_WORDS) {
    assert.ok(
      !word.test(row.accountKindStatement),
      `the account-kind sentence borrows no Google vocabulary (${word})`,
    );
    for (const capability of row.capabilities) {
      assert.ok(
        !word.test(capability.statement),
        `the capability sentence borrows no Google vocabulary (${word})`,
      );
    }
  }

  assert.ok(
    /organization/i.test(row.accountKindStatement),
    "the account kind states what GitHub actually verified — an organization",
  );

  for (const capability of row.capabilities) {
    assert.ok(
      capability.label !== capability.capability,
      "an available capability is named for a human, not printed as its raw identifier",
    );
    /*
     * AVAILABLE MAY NOT READ AS EXECUTED. The transport knows one address and the acceptance
     * reachability gate reports this capability NOT-IMPLEMENTED, so the sentence must say that no
     * repository and no pull request is read.
     */
    if (capability.available) {
      assert.ok(
        /reads no repository/i.test(capability.statement),
        "an available-but-unimplemented capability says what it does not do",
      );
    }
  }

  const html = render(model);
  for (const word of [/google/i, /workspace domain/i, /\bDrive\b/]) {
    assert.ok(!word.test(html), `the rendered GitHub page contains no Google vocabulary (${word})`);
  }
}

/* ── The bite harness ───────────────────────────────────────────────────────── */

/**
 * Each guard is handed a model corrupted in exactly the way it exists to catch, and MUST throw.
 * One deliberately CORRECT model is also run through and must be ACCEPTED — without it, "every
 * mutation bit" is indistinguishable from "these assertions are brittle".
 */
function biteProofs(): void {
  const clone = (m: IntegrationsModel): IntegrationsModel => JSON.parse(JSON.stringify(m));
  const bites: ReadonlyArray<{ label: string; run: () => void }> = [
    {
      label: "M1 a connected integration is hidden",
      run: () => {
        const broken = clone(CONNECTED);
        (broken as { connected: unknown }).connected = [];
        connectedIntegrationIsVisible(broken);
      },
    },
    {
      label: "M2 the account label is dropped from the connected row",
      run: () => {
        const broken = clone(CONNECTED);
        (broken.connected[0] as { accountLabel: string | null }).accountLabel = null;
        connectedIntegrationIsVisible(broken);
      },
    },
    {
      label: "M3 a descriptor claims connected",
      run: () => {
        const broken = clone(EMPTY);
        (broken.candidates[0] as { connectionState: string }).connectionState = "Connected";
        descriptorsAreNeverConnected(broken);
      },
    },
    {
      label: "M4 a descriptor grows a connection field",
      run: () => {
        const broken = clone(EMPTY);
        (broken.candidates[0] as unknown as { health: string }).health = "healthy";
        descriptorsAreNeverConnected(broken);
      },
    },
    {
      label: "M5 the headline denies a connection that exists",
      run: () => {
        const broken = clone(CONNECTED);
        (broken.state as { headline: string }).headline = "No integration connected";
        noneClaimTracksTheAuthority(broken);
      },
    },
    {
      label: "M6 the count disagrees with the list",
      run: () => {
        const broken = clone(CONNECTED);
        (broken.state as { connectedCount: number }).connectedCount = 0;
        noneClaimTracksTheAuthority(broken);
      },
    },
    {
      label: "M7 a secret reaches the page model",
      run: () => {
        const broken = clone(CONNECTED);
        (broken.connected[0] as unknown as { refreshToken: string }).refreshToken = "1//0gABC";
        modelCarriesNoSecret(broken);
      },
    },
    {
      label: "M8 the subject id reaches the page model",
      run: () => {
        const broken = clone(CONNECTED);
        (broken.connected[0] as unknown as { externalAccountId: string }).externalAccountId =
          "114884615390589849256";
        modelCarriesNoSecret(broken);
      },
    },
    {
      label: "M9 a consumer account is called a verified Workspace domain",
      run: () => {
        const broken = clone(CONNECTED);
        (broken.connected[0] as { accountKindStatement: string }).accountKindStatement =
          "Google Account in a verified Google Workspace domain.";
        consumerAccountIsNotLabelledWorkspace(broken);
      },
    },
    {
      label: "M10 the capability statement overclaims",
      run: () => {
        const broken = clone(CONNECTED);
        (broken.connected[0] as { capabilityStatement: string }).capabilityStatement =
          "Full access to Drive access and Calendar.";
        capabilityStatementIsTruthful(broken);
      },
    },
    {
      /* The exact sentence production rendered on the GitHub card before the fix. */
      label: "M11 a GitHub organization is called a Google Account",
      run: () => {
        const broken = clone(GITHUB_CONNECTED);
        (broken.connected[0] as { accountKindStatement: string }).accountKindStatement =
          "Google Account. No verified Google Workspace domain was recorded for this connection, so none is claimed.";
        aSecondProviderIsNotDescribedAsTheFirst(broken);
      },
    },
    {
      /* Likewise: Google's capability sentence, printed for a GitHub permission. */
      label: "M12 a GitHub capability borrows Drive's sentence",
      run: () => {
        const broken = clone(GITHUB_CONNECTED);
        (broken.connected[0].capabilities[0] as { statement: string }).statement =
          "Available. Read-only file discovery and metadata. Hebun reads no file content, and holds no permission to change anything in Drive.";
        aSecondProviderIsNotDescribedAsTheFirst(broken);
      },
    },
    {
      label: "M13 an available capability is printed as its raw identifier",
      run: () => {
        const broken = clone(GITHUB_CONNECTED);
        (broken.connected[0].capabilities[0] as { label: string }).label =
          broken.connected[0].capabilities[0].capability;
        aSecondProviderIsNotDescribedAsTheFirst(broken);
      },
    },
    {
      label: "M14 an unimplemented capability stops saying it reads nothing",
      run: () => {
        const broken = clone(GITHUB_CONNECTED);
        (broken.connected[0].capabilities[0] as { statement: string }).statement =
          "Available. Repository activity, read-only.";
        aSecondProviderIsNotDescribedAsTheFirst(broken);
      },
    },
  ];

  const bitten: string[] = [];
  for (const bite of bites) {
    let bit = false;
    try {
      bite.run();
    } catch {
      bit = true;
    }
    assert.ok(bit, `${bite.label} must be rejected`);
    bitten.push(bite.label.split(" ")[0]);
  }
  /* Printed so the release record carries the measurement, not a claim that one was taken. */
  console.log(`bite-proofs BITTEN (${bitten.length}/${bites.length}): ${bitten.join(", ")}`);

  /* The harness itself: a CORRECT model must be accepted, or "10 of 10 bit" proves nothing. */
  let accepted = true;
  try {
    connectedIntegrationIsVisible(clone(CONNECTED));
    descriptorsAreNeverConnected(clone(CONNECTED));
    noneClaimTracksTheAuthority(clone(CONNECTED));
    modelCarriesNoSecret(clone(CONNECTED));
    consumerAccountIsNotLabelledWorkspace(clone(CONNECTED));
    capabilityStatementIsTruthful(clone(CONNECTED));
    aSecondProviderIsNotDescribedAsTheFirst(clone(GITHUB_CONNECTED));
  } catch {
    accepted = false;
  }
  assert.ok(accepted, "a correct model must be ACCEPTED — otherwise the guards are brittle, not strict");
  console.log("known-correct model ACCEPTED");
}

function main(): void {
  connectedIntegrationIsVisible(CONNECTED);
  nonConnectedAuthorityRowsAreNotDropped();

  descriptorsAreNeverConnected(CONNECTED);
  descriptorsAreNeverConnected(EMPTY);
  descriptorSectionDoesNotImplyConnection();

  noneClaimTracksTheAuthority(CONNECTED);
  noneClaimTracksTheAuthority(EMPTY);
  unreadableAuthorityIsNotADenial();

  modelCarriesNoSecret(CONNECTED);
  modelCarriesNoSecret(EMPTY);
  theCredentialAuthorityIsUnreachable();
  thePageReadsTheAuthorityAndNothingElse();

  consumerAccountIsNotLabelledWorkspace(CONNECTED);
  aCustomDomainAddressStillClaimsNothing();
  theHostedDomainIsNotPersisted();

  capabilityStatementIsTruthful(CONNECTED);

  aSecondProviderIsNotDescribedAsTheFirst(GITHUB_CONNECTED);

  biteProofs();

  console.log("INT-3.1 platform integrations truthful-surface checks passed");
}

main();
