/*
 * GITHUB-1 — THE REAL GITHUB PROVIDER CONTRACT.
 *
 * ── WHAT THIS SUITE DEFENDS ─────────────────────────────────────────────────
 *
 *   1. The real GitHub provider is NOT the simulation GitHub provider, and no literal is shared.
 *   2. The catalog is the only place a real GitHub provider is defined.
 *   3. It is an ORGANIZATION provider, and a personal installation is nameable and refused.
 *   4. NO write permission is requested, declared, or reachable.
 *   5. A granted permission map normalizes into the released `integrations.scopes` shape, with
 *      requested and granted kept apart.
 *   6. The first capability cannot reach source-file content — the allow list contains no address
 *      for one, and the pinned media type is not a diff.
 *   7. Nothing under `provider-github` performs I/O, imports a writer, or touches Knowledge.
 *
 * It calls no provider, starts no installation, reads no credential and touches no database. It is
 * a statement about this repository, made entirely from this repository.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { PROVIDER_CATALOG, findProviderDefinition } from "../../src/features/provider-catalog/catalog";
import {
  GITHUB_ACCEPTED_REPOSITORY_SELECTION,
  GITHUB_ACCEPT_MEDIA_TYPE,
  GITHUB_ALLOWED_REQUEST_PATHS,
  GITHUB_API_ORIGIN,
  GITHUB_FORBIDDEN_ACCEPT_MEDIA_TYPES,
  GITHUB_FORBIDDEN_PATH_FRAGMENTS,
  GITHUB_FORBIDDEN_PERMISSION_NAMES,
  GITHUB_ORGANIZATION_ACCOUNT_TYPE,
  GITHUB_PROVIDER_KEY,
  GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  GITHUB_REPOSITORY_ACTIVITY_READ_PERMISSIONS,
  GITHUB_REPOSITORY_ACTIVITY_WRITE_PERMISSIONS,
  GITHUB_REQUESTED_PERMISSIONS,
  GITHUB_REQUIRED_GRANTED_PERMISSIONS,
  MAX_PULL_REQUESTS_PER_PAGE,
  MAX_REPOSITORIES_PER_PAGE,
  coversRequiredPermissions,
  isAllowedRequestPath,
  isWritePermission,
  normalizeGrantedPermissions,
  parseGitHubPermission,
} from "../../src/features/provider-github/contracts";
import { GITHUB_PROVIDER_ID } from "../../src/features/providers/github/types";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
/** Comments are stripped before a source assertion, so honest prose can never satisfy a ban. */
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const GITHUB_DIR = "src/features/provider-github";

function collect(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const GITHUB_MODULES = collect(GITHUB_DIR);

/* ── 1. THE REAL PROVIDER IS NOT THE SIMULATION PROVIDER ────────────────────── */
function theRealProviderIsNotTheSimulationProvider(): void {
  /*
   * `features/providers/github` is World B: `simulation: true`, execution mode `simulation`, and
   * deterministic fixtures for issues, workflows and releases. It must never be able to satisfy a
   * real connection, and the cheapest structural way to guarantee that is for the two worlds to
   * share NO identifier at all.
   */
  assert.notEqual(
    GITHUB_PROVIDER_KEY,
    GITHUB_PROVIDER_ID,
    "the real catalog key and the simulation provider id must not be the same string",
  );
  assert.equal(GITHUB_PROVIDER_ID, "github", "the simulation provider id is still the bare key");
  assert.equal(GITHUB_PROVIDER_KEY, "github-organization");

  /* The simulation provider is NOT in the catalog, by key or by any alias of it. */
  assert.equal(
    findProviderDefinition(GITHUB_PROVIDER_ID),
    undefined,
    "the simulation provider id must name no connectable catalog entry",
  );

  /*
   * ── THE FIREWALL: NEITHER WORLD MAY IMPORT THE OTHER ───────────────────────
   *
   * Asserted on IMPORT SPECIFIERS, not on raw text and not on stripped code. The ban is about
   * REACHABILITY, and only a module specifier creates reachability: a comment that NAMES the other
   * world is discussion, and this file's own module explains at length why the two worlds are
   * separate. A raw-text ban was written first and failed on exactly that prose — the same defect
   * G5A and R6D both hit, where a guard was satisfied or broken by honest sentences rather than by
   * mechanism. Comments are stripped so a commented-out import cannot hide, and only the
   * surviving specifiers are judged.
   */
  const specifiersOf = (file: string): string[] =>
    [...codeOf(read(file)).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);

  for (const file of GITHUB_MODULES) {
    for (const specifier of specifiersOf(file)) {
      assert.ok(
        !specifier.includes("features/providers/"),
        `${file} imports ${specifier} — the real provider may never reach the simulation tree`,
      );
    }
  }

  /* And the reverse: the simulation must not learn about the real provider either. */
  for (const file of collect("src/features/providers/github")) {
    for (const specifier of specifiersOf(file)) {
      for (const forbidden of ["provider-github", "provider-catalog", "integration-authority"]) {
        assert.ok(
          !specifier.includes(forbidden),
          `${file} imports ${specifier} — the simulation may never reach real connection truth`,
        );
      }
    }
  }
}

/* ── 2. GITHUB IS CONNECTABLE, AND ONLY BECAUSE THE VERIFIER EXISTS ────────── */
function theCatalogOffersGithubOnlyBecauseAVerifierExists(): void {
  /*
   * ── AMENDED BY GITHUB-2, AND THE RULE DID NOT CHANGE ──────────────────────
   *
   * This assertion used to read `findProviderDefinition(GITHUB_PROVIDER_KEY) === undefined`, with
   * the reason: "GitHub is not connectable until a verifier exists". That was correct. GITHUB-1
   * had written the catalog entry and deleted it before release, because a `connectable` entry
   * would have offered a connection no code could complete.
   *
   * GITHUB-2 BUILT THE VERIFIER, so the condition the old assertion named is now satisfied and the
   * pin is INVERTED rather than deleted: the entry may exist, and it may exist ONLY while the seam
   * that justifies it does. The second half is the part that keeps this a guard — removing
   * `verify-installation.server.ts` while leaving the catalog entry fails here.
   */
  const github = findProviderDefinition(GITHUB_PROVIDER_KEY);
  assert.ok(github, "GitHub is in the frozen catalog now that an installation verifier exists");
  assert.equal(github.connectivity, "connectable");
  assert.equal(github.authMethod, "github_app", "a GitHub App installation is not OAuth2");
  assert.equal(github.accountIdentity, "organization");
  assert.equal(github.label, "GitHub");

  /* Exactly one entry claims this key — a second definition anywhere would be a second authority. */
  assert.equal(
    PROVIDER_CATALOG.filter((p) => p.providerKey === GITHUB_PROVIDER_KEY).length,
    1,
    "exactly one catalog entry defines the real GitHub provider",
  );

  /*
   * ── THE ENTRY MAY NOT OUTLIVE ITS JUSTIFICATION ───────────────────────────
   *
   * A `connectable` claim rests on a real verifier: something that asks GitHub what an
   * installation id names, over the network, authenticated as the App. Asserted by MECHANISM —
   * the module must exist, must reach the transport, and the transport must perform outbound HTTP
   * — rather than by a file name a future refactor could keep while gutting the contents.
   */
  const verifier = `${GITHUB_DIR}/verify-installation.server.ts`;
  const transport = `${GITHUB_DIR}/github-transport.server.ts`;
  assert.ok(existsSync(path.join(ROOT, verifier)), "the installation verifier exists");
  assert.ok(existsSync(path.join(ROOT, transport)), "the GitHub transport exists");
  assert.ok(
    codeOf(read(verifier)).includes("github-transport.server"),
    "the verifier reaches the transport — a verifier that asks nobody verifies nothing",
  );
  /*
   * The SAME pattern the released acceptance-reachability gate uses to identify a provider
   * transport. A first version matched a literal `fetch(` and failed here, because the transport
   * calls `doFetch(...)` through an injectable — which is exactly the shape that gate already
   * learned to recognise. Restating it in different words would have been a second, weaker
   * definition of "performs outbound HTTP".
   */
  assert.ok(
    /\bfetch\s*\(|fetchImpl\s*\?\?\s*fetch/.test(codeOf(read(transport))),
    "the transport performs a real outbound request",
  );
  assert.ok(
    codeOf(read(transport)).includes("/app/installations/"),
    "the transport reads the installation record, which is what makes the claim checkable",
  );

  assert.equal(GITHUB_PROVIDER_KEY, "github-organization");
  assert.ok(GITHUB_REQUESTED_PERMISSIONS.length > 0, "the permission contract is written");

  /*
   * `authMethod` IS VOCABULARY, NOT A RUNTIME BRANCH. It is widened by this phase, and that is
   * only safe while nothing switches on it and nothing stores it. Asserted rather than promised.
   */
  const authMethodFiles = collect("src/features")
    .concat(collect("src/app"), collect("src/components"))
    .filter((f) => /\bauthMethod\b/.test(codeOf(read(f))));
  assert.deepEqual(
    authMethodFiles,
    [
      /* DECLARES the field and the union. */
      "src/features/integration-authority/contracts.ts",
      /* WRITES a value. */
      "src/features/provider-catalog/catalog.ts",
    ],
    "authMethod is declared in one place and written in one place — nothing else may touch it",
  );
  for (const file of authMethodFiles) {
    const code = codeOf(read(file));
    assert.ok(
      !/switch\s*\([^)]*authMethod/.test(code),
      `${file} branches on authMethod — widening the union would then change behaviour`,
    );
    assert.ok(
      !/authMethod\s*===|===\s*"(oauth2|api_key|github_app)"/.test(code),
      `${file} compares authMethod — it is vocabulary, not a runtime decision`,
    );
  }
  /*
   * AND IT IS NEVER PERSISTED. No column carries it, so no stored row can disagree with the frozen
   * catalog about how a provider authenticates.
   */
  for (const file of collect("src/db")) {
    assert.ok(
      !/auth_method|authMethod/.test(read(file)),
      `${file}: authMethod must never become a column`,
    );
  }
}

/* ── 3. AN ORGANIZATION PROVIDER, WITH THE REFUSAL EXPRESSIBLE ──────────────── */
function itIsAnOrganizationProviderAndCanSayNoToAnythingElse(): void {
  /*
   * The catalog entry that will carry `accountIdentity: "organization"` is deferred with the rest
   * of the definition, so the ORGANIZATION decision is pinned where it actually lives in this
   * phase: in the provider's own vocabulary. `GITHUB_ORGANIZATION_ACCOUNT_TYPE` is GitHub's own
   * spelling of `installation.account.type`, and it is the value a personal installation will be
   * refused against.
   */
  assert.equal(GITHUB_ORGANIZATION_ACCOUNT_TYPE, "Organization", "GitHub's own spelling");
  assert.equal(
    GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
    "github.repository.activity.read",
    "the capability names repository activity — never repositories, never GitHub at large",
  );
  assert.deepEqual(
    [...GITHUB_REPOSITORY_ACTIVITY_READ_PERMISSIONS],
    ["metadata:read", "pull_requests:read"],
    "repository identity AND pull-request activity — both, and nothing else",
  );

  /*
   * A union of one could not express a refusal. `all` must be NAMEABLE so an installation that
   * widened to every repository looks different from a compliant one rather than identical to it.
   */
  assert.deepEqual(
    [...GITHUB_ACCEPTED_REPOSITORY_SELECTION],
    ["selected"],
    "selected repositories only — an all-repository installation is refused",
  );
  const contracts = read(`${GITHUB_DIR}/contracts.ts`);
  assert.ok(
    /GitHubRepositorySelection\s*=\s*"selected"\s*\|\s*"all"/.test(codeOf(contracts)),
    "the selection type must be able to name `all` in order to refuse it",
  );
}

/* ── 4. NO WRITE, ANYWHERE ──────────────────────────────────────────────────── */
function noWritePermissionIsRequestedDeclaredOrReachable(): void {
  for (const permission of GITHUB_REQUESTED_PERMISSIONS) {
    assert.ok(!isWritePermission(permission), `${permission} is a write — none may be requested`);
  }
  for (const permission of GITHUB_REQUIRED_GRANTED_PERMISSIONS) {
    assert.ok(!isWritePermission(permission), `${permission} is a write`);
  }
  for (const permission of GITHUB_REPOSITORY_ACTIVITY_READ_PERMISSIONS) {
    assert.ok(!isWritePermission(permission), `${permission} is a write`);
  }

  /*
   * AN EMPTY WRITE LIST IS NOT A VACUOUS TRUTH. The availability seam computes
   * `writeCapable = isUsable && scopes.write.length > 0 && covers(...)`, so an empty list makes
   * write STRUCTURALLY unreachable rather than merely unused.
   */
  assert.equal(
    GITHUB_REPOSITORY_ACTIVITY_WRITE_PERMISSIONS.length,
    0,
    "the capability declares no write permission — write is structurally unreachable",
  );
  /*
   * AND NO CATALOG ENTRY CARRIES A GITHUB WRITE EITHER — asserted over the whole catalog rather
   * than over one entry, so it stays true both now, while GitHub is absent, and after GITHUB-2
   * adds it. A pin scoped to an entry that does not exist would be vacuous.
   */
  for (const provider of PROVIDER_CATALOG) {
    for (const [capability, scopes] of Object.entries(provider.capabilityScopes)) {
      if (!capability.startsWith("github.")) continue;
      assert.equal(scopes.write.length, 0, `${capability} may declare no write scope`);
    }
  }

  /* And no forbidden permission name may appear in the requested set. */
  for (const permission of GITHUB_REQUESTED_PERMISSIONS) {
    const parsed = parseGitHubPermission(permission);
    assert.ok(parsed, `${permission} must parse as name:level`);
    assert.ok(
      !GITHUB_FORBIDDEN_PERMISSION_NAMES.includes(parsed.name),
      `${parsed.name} is on the deny list and may never be requested`,
    );
  }
  /* `contents` is the permission that would buy source files. Named, so its absence is asserted. */
  assert.ok(GITHUB_FORBIDDEN_PERMISSION_NAMES.includes("contents"));
  assert.ok(GITHUB_FORBIDDEN_PERMISSION_NAMES.includes("administration"));
  assert.ok(GITHUB_FORBIDDEN_PERMISSION_NAMES.includes("workflows"));
}

/* ── 5. REQUESTED ≠ GRANTED, AND THE NORMALIZATION IS HONEST ────────────────── */
function requestedAndGrantedStayTwoDifferentSets(): void {
  /*
   * The whole lesson of INT-3 lesson 11: truth is the provider's returned permissions. If these
   * two constants were the same value, "covered" would be measuring what Hebun hoped for.
   */
  assert.notDeepEqual(
    [...GITHUB_REQUESTED_PERMISSIONS],
    [...GITHUB_REQUIRED_GRANTED_PERMISSIONS],
    "requested and required-granted must be distinguishable sets",
  );
  assert.ok(
    GITHUB_REQUIRED_GRANTED_PERMISSIONS.every((p) => GITHUB_REQUESTED_PERMISSIONS.includes(p)),
    "Hebun may never require a permission it never asks for",
  );

  /* GitHub's map, in GitHub's spelling, flattened into the released `string[]` column shape. */
  assert.deepEqual(
    [...normalizeGrantedPermissions({ metadata: "read", pull_requests: "read" })],
    ["metadata:read", "pull_requests:read"],
  );
  /* Sorted, so two identical grants compare equal whatever order GitHub serialized them in. */
  assert.deepEqual(
    [...normalizeGrantedPermissions({ pull_requests: "read", metadata: "read" })],
    ["metadata:read", "pull_requests:read"],
  );
  /* A write GitHub granted is REPORTED, never dropped — the tenant must be able to see it. */
  assert.deepEqual([...normalizeGrantedPermissions({ contents: "write" })], ["contents:write"]);

  /* Hostile input yields no permission rather than a permission Hebun never received. */
  assert.deepEqual([...normalizeGrantedPermissions(null)], []);
  assert.deepEqual([...normalizeGrantedPermissions(undefined)], []);
  assert.deepEqual([...normalizeGrantedPermissions({})], []);
  assert.deepEqual(
    [...normalizeGrantedPermissions({ metadata: "sudo" })],
    [],
    "an unrecognized level is not a level",
  );
  assert.deepEqual([...normalizeGrantedPermissions({ metadata: 1 as unknown as string })], []);
  assert.deepEqual([...normalizeGrantedPermissions({ "": "read" })], []);
  /*
   * `Object.keys` cannot see an inherited property, so a prototype-borne permission is invisible
   * rather than accepted. Pinned because INT-4 found the equivalent bug in a bare map lookup.
   */
  const inherited = Object.create({ contents: "write" }) as Record<string, unknown>;
  assert.deepEqual(
    [...normalizeGrantedPermissions(inherited)],
    [],
    "an inherited permission is invisible, never accepted",
  );

  /* Parsing is strict: an unrecognized level is not a level. */
  assert.equal(parseGitHubPermission("metadata"), null);
  assert.equal(parseGitHubPermission(":read"), null);
  assert.equal(parseGitHubPermission("metadata:sudo"), null);
  assert.deepEqual(parseGitHubPermission("metadata:read"), { name: "metadata", level: "read" });

  /*
   * EXACT MATCH, NOT LEVEL SUBSUMPTION. GitHub would let `metadata:write` perform the read, but
   * this provider never requests a write, so a grant carrying one must not launder into coverage.
   */
  assert.equal(coversRequiredPermissions(["metadata:read"]), true, "the exact grant covers");
  assert.equal(
    coversRequiredPermissions(["metadata:write"]),
    false,
    "a write must never launder into satisfying a read requirement",
  );
  assert.equal(coversRequiredPermissions([]), false, "an empty grant covers nothing");
  assert.equal(
    coversRequiredPermissions(["pull_requests:read"]),
    false,
    "a different permission does not satisfy the required one",
  );
}

/* ── 6. THE SOURCE-CONTENT FIREWALL ─────────────────────────────────────────── */
function theFirstCapabilityHasNoAddressForSourceContent(): void {
  /*
   * ── THE FACT THIS SECTION EXISTS FOR ──────────────────────────────────────
   *
   * GitHub's `pull_requests:read` ALSO grants `/pulls/{pull_number}/files`, whose response carries
   * a `patch`, and a `diff` media type on `/pulls/{pull_number}`. Unlike Google's
   * `drive.metadata.readonly`, the provider does not hold this boundary for us. These constants do.
   */
  assert.ok(GITHUB_ALLOWED_REQUEST_PATHS.length > 0, "the allow list is not empty");
  for (const allowed of GITHUB_ALLOWED_REQUEST_PATHS) {
    assert.ok(allowed.startsWith("/"), `${allowed} must be a path, never an origin`);
    for (const forbidden of GITHUB_FORBIDDEN_PATH_FRAGMENTS) {
      assert.ok(
        !allowed.includes(forbidden),
        `the allow list member ${allowed} reaches ${forbidden} — that is source content or a ` +
          `deferred surface`,
      );
    }
  }
  /* Deny by default: a path that is not written down is not allowed. */
  assert.equal(isAllowedRequestPath("/repos/{owner}/{repo}/pulls"), true);
  assert.equal(isAllowedRequestPath("/repos/{owner}/{repo}/pulls/1/files"), false);
  assert.equal(isAllowedRequestPath("/repos/{owner}/{repo}/contents/README.md"), false);
  assert.equal(isAllowedRequestPath("/repos/{owner}/{repo}/commits"), false);
  assert.equal(isAllowedRequestPath(""), false);

  /* The pinned media type must not be one of the ones that returns a diff. */
  assert.ok(
    !GITHUB_FORBIDDEN_ACCEPT_MEDIA_TYPES.includes(GITHUB_ACCEPT_MEDIA_TYPE),
    "the pinned Accept header must not be a diff, patch or raw media type",
  );
  assert.equal(
    GITHUB_ACCEPT_MEDIA_TYPE,
    "application/vnd.github+json",
    "the pinned media type is JSON metadata",
  );
  assert.ok(GITHUB_FORBIDDEN_ACCEPT_MEDIA_TYPES.includes("application/vnd.github.diff"));
  assert.ok(GITHUB_FORBIDDEN_ACCEPT_MEDIA_TYPES.includes("application/vnd.github.patch"));

  /*
   * ── THE SHAPE HAS NO HOLE FOR CONTENT ─────────────────────────────────────
   *
   * A field named `patch` or `diff` on the pull-request view would be filled by somebody, and the
   * granted permission would let them. Asserted on the stripped source of the interface, so the
   * words may still be DISCUSSED in this file's own prose and in the module's.
   */
  const contracts = codeOf(read(`${GITHUB_DIR}/contracts.ts`));
  const prView = contracts.slice(
    contracts.indexOf("interface GitHubPullRequestView"),
    contracts.indexOf("}", contracts.indexOf("interface GitHubPullRequestView")),
  );
  assert.ok(prView.length > 0, "the pull-request view exists");
  for (const banned of ["patch", "diff", "body", "files", "sha", "content"]) {
    assert.ok(
      !new RegExp(`\\b${banned}\\b`, "i").test(prView),
      `GitHubPullRequestView declares a \`${banned}\` field — that is a hole for source content`,
    );
  }

  /* Bounded well under GitHub's own per-page maximum of 100 — a listing is not an export. */
  assert.ok(MAX_REPOSITORIES_PER_PAGE > 0 && MAX_REPOSITORIES_PER_PAGE <= 50);
  assert.ok(MAX_PULL_REQUESTS_PER_PAGE > 0 && MAX_PULL_REQUESTS_PER_PAGE <= 50);
}

/* ── 7. WHO MAY TOUCH WHAT, INSIDE THE PROVIDER ─────────────────────────────── */
function eachProviderModuleTouchesOnlyWhatItsRoleAllows(): void {
  /*
   * ── AMENDED BY GITHUB-2, AND MADE STRICTER RATHER THAN LOOSER ─────────────
   *
   * GITHUB-1 banned `fetch`, `@/db`, `drizzle-orm` and `node:crypto` from EVERY file under
   * `provider-github`, because that phase was pure contract and the blanket ban was exactly true.
   *
   * GITHUB-2 legitimately needs all four — a transport that calls GitHub, an orchestrator that
   * writes through the lifecycle authority, and a JWT signer. Relaxing the ban to "these are fine
   * now" would trade a real guard for nothing, so it is replaced by a PER-ROLE rule: each
   * capability is permitted in exactly one file, and forbidden in the others.
   *
   * That is a stronger statement than the original. The old rule said the provider does no I/O;
   * this one says there is exactly ONE place it can, exactly one place it can write, and no place
   * at all that it can reach Knowledge or a credential vault.
   */
  assert.ok(GITHUB_MODULES.length > 0, "the provider module tree exists");

  const OUTBOUND = /\bfetch\s*\(|fetchImpl\s*\?\?\s*fetch|\bXMLHttpRequest\b/;
  const TRANSPORT = `${GITHUB_DIR}/github-transport.server.ts`;
  const ORCHESTRATOR = `${GITHUB_DIR}/connect-installation.server.ts`;
  const JWT = `${GITHUB_DIR}/github-app-jwt.server.ts`;
  const STATE = `${GITHUB_DIR}/install-state.server.ts`;
  const ENVIRONMENT = `${GITHUB_DIR}/github-environment.server.ts`;

  for (const file of GITHUB_MODULES) {
    const code = codeOf(read(file));

    /*
     * ── ONE TRANSPORT, AND ONLY ONE ───────────────────────────────────────
     *
     * A second module that could reach GitHub is a second place the source-content allow list has
     * to be enforced, and the one nobody remembers to check.
     */
    if (file !== TRANSPORT) {
      assert.ok(
        !OUTBOUND.test(code),
        `${file} performs outbound HTTP — only ${TRANSPORT} may talk to GitHub`,
      );
    }

    /*
     * ── ONE WRITER, AND IT WRITES THROUGH THE AUTHORITY ───────────────────
     *
     * Only the orchestrator may reach a database, and even it holds no SQL: it composes released
     * writers. Everything else is forbidden the handle entirely.
     */
    if (file !== ORCHESTRATOR) {
      for (const forbidden of ["@/db", "drizzle-orm"]) {
        assert.ok(
          !code.includes(forbidden),
          `${file} imports ${forbidden} — only ${ORCHESTRATOR} composes the connection lifecycle`,
        );
      }
    }

    /*
     * ── REPAIRED BY GITHUB-4, AND MADE STRICTER RATHER THAN WEAKER ────────
     *
     * This assertion used to forbid `integration-authority` outright, which was correct while the
     * orchestrator was the only module with any reason to reach it. GITHUB-4 adds an executable
     * read capability, and its modules must ASK that authority whether a tenant may spend the
     * capability — refusing them the import would not have kept them from deciding, it would have
     * forced them to decide for themselves, which is the two-interpreters bug the authority exists
     * to prevent.
     *
     * So the rule is no longer "who may import the authority" but "who may WRITE through it".
     * Every module still fails on a writer symbol; only the orchestrator composes a lifecycle. The
     * database handle itself remains forbidden above, so a reader cannot reach past the seam.
     */
    if (file !== ORCHESTRATOR) {
      for (const writer of [
        "createConnection",
        "recordVerifiedInstallation",
        "recordVerificationFailure",
        "disconnectConnection",
        "markConnection",
      ]) {
        assert.ok(
          !code.includes(writer),
          `${file} calls ${writer} — only ${ORCHESTRATOR} composes the connection lifecycle`,
        );
      }
    }

    /* Key material and signing live in two named files. Nowhere else may hold either. */
    if (file !== JWT && file !== STATE && file !== ENVIRONMENT) {
      assert.ok(
        !code.includes("node:crypto"),
        `${file} imports node:crypto — signing and state sealing have named homes`,
      );
    }

    /*
     * ── THESE STAY BANNED EVERYWHERE, IN EVERY PHASE ──────────────────────
     *
     * PROVIDER DATA IS NOT KNOWLEDGE, and this provider holds no tenant secret. Neither is a
     * policy here: no module can import a Knowledge writer, a Governance authority, or the
     * credential vault, so neither can happen by accident.
     */
    for (const forbidden of [
      "features/knowledge",
      "features/governance",
      "integration-credentials",
      "secret-encryption",
      "node:fs",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `${file} imports ${forbidden} — the GitHub provider stores no secret and admits no Knowledge`,
      );
    }
  }

  /* The orchestrator composes; it does not query. No SQL builder may appear in it. */
  const orchestrator = codeOf(read(ORCHESTRATOR));
  for (const sqlish of ["drizzle-orm", ".select(", ".update(", ".insert(", "sql`"]) {
    assert.ok(
      !orchestrator.includes(sqlish),
      `${ORCHESTRATOR} contains ${sqlish} — it composes released writers and owns no SQL`,
    );
  }

  assert.equal(GITHUB_API_ORIGIN, "https://api.github.com");
  assert.ok(
    GITHUB_API_ORIGIN.startsWith("https://"),
    "the provider origin is TLS-only and is a constant, not configuration",
  );
}

function main(): void {
  theRealProviderIsNotTheSimulationProvider();
  theCatalogOffersGithubOnlyBecauseAVerifierExists();
  itIsAnOrganizationProviderAndCanSayNoToAnythingElse();
  noWritePermissionIsRequestedDeclaredOrReachable();
  requestedAndGrantedStayTwoDifferentSets();
  theFirstCapabilityHasNoAddressForSourceContent();
  eachProviderModuleTouchesOnlyWhatItsRoleAllows();
  console.log("github1-provider-contract/contract: all assertions passed");
}

main();
