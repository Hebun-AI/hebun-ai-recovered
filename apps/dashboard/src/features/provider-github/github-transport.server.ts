/*
 * provider-github/github-transport.server.ts — THE ONLY PLACE HEBUN TALKS TO GITHUB.
 *
 * ── IT KNOWS EXACTLY FOUR OPERATIONS, AND REFUSES EVERYTHING ELSE ────────────
 *
 * GITHUB-2 knew one endpoint, and its enforcement was incidental: the module hard-coded a single
 * URL template, so nothing else COULD be requested. That stops being enforcement the moment a
 * second call exists, and GITHUB-4 adds three. The Stage T closure recorded the same fact from the
 * other side — `isAllowedRequestPath` had ZERO runtime callers, so the declared allow list had
 * never gated one byte of traffic.
 *
 * So the boundary is now a POLICY THIS FILE CONSULTS BEFORE EVERY REQUEST, keyed on four
 * dimensions together — method, path template, authentication class, Accept — and denying by
 * default. A test-only allow list is not a security boundary; this is.
 *
 * ── AUTHENTICATION CLASS IS PART OF AN OPERATION'S IDENTITY ──────────────────
 *
 * `GET /app/installations/{id}` is authenticated as the APP. `GET /installation/repositories` is
 * authenticated as the INSTALLATION. They are not the same request with a different header: the
 * first proves who Hebun is, the second spends what an organization granted. Presenting the wrong
 * class is its own refusal, and that split is what makes "the App may read an installation, but
 * may not read a repository" a mechanism rather than a habit.
 *
 * ── IT AUTHORIZES NOTHING ───────────────────────────────────────────────────
 *
 * The firewall answers ONE question: may this transport operation exist? It does NOT answer
 * whether this tenant may spend the capability — that is the availability authority's, upstream,
 * and duplicating it here would be a second interpreter of the same rule.
 *
 * ── NO CALLER-SUPPLIED PATHS ────────────────────────────────────────────────
 *
 * There is no `githubRequest(path)` and no URL parameter anywhere in this module's public API.
 * Every exported function names one operation; the only caller-shaped values are a validated
 * positive integer and two repository segments that came out of GitHub's own listing.
 *
 * ── FAILURE CLASSES ARE THE POINT ────────────────────────────────────────────
 *
 * INT-4 learned this against real Google: collapsing a provider-side configuration fact into "the
 * credential was refused" makes Hebun retry what no retry can fix and tells a tenant their grant
 * is broken when it is not. So a 404 is `installation`, a 401 is `auth`, a 5xx or a timeout is
 * `transport`, and NOTHING about the tenant's grant is inferred from a network failure.
 *
 * Server-only.
 */
import {
  GITHUB_ACCEPT_MEDIA_TYPE,
  GITHUB_API_ORIGIN,
  MAX_PULL_REQUESTS_PER_PAGE,
  MAX_REPOSITORIES_PER_PAGE,
  type GitHubFailure,
} from "./contracts";

/** Injected in tests. Production always uses the platform `fetch`. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GitHubTransportDeps {
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** GitHub's documented REST version pin. An unpinned client silently follows a moving contract. */
const GITHUB_API_VERSION = "2022-11-28";

/**
 * WHICH CREDENTIAL AN OPERATION IS SPENT WITH.
 *
 * `app` — a JWT signed with the deployment's App private key. Proves Hebun is this GitHub App.
 * `installation` — a short-lived token minted for one installation. Proves an organization granted
 * something. Never persisted, never cached, never returned to a caller: see
 * `github-authorized-call.server.ts`.
 */
export type GitHubAuthClass = "app" | "installation";

/** The operations this provider may issue. The union IS the allow list — there is no other. */
export type GitHubOperationId =
  | "read-installation"
  | "mint-installation-token"
  | "list-installation-repositories"
  | "list-open-pull-requests";

export interface GitHubOperationPolicy {
  readonly id: GitHubOperationId;
  readonly method: "GET" | "POST";
  /** Written with GitHub's own placeholder spelling so it can be compared to a declared list. */
  readonly pathTemplate: string;
  readonly auth: GitHubAuthClass;
  readonly accept: string;
}

/**
 * ── THE FIREWALL TABLE ──────────────────────────────────────────────────────
 *
 * Four operations. Every field is part of the key, so a request that gets the path right and the
 * authentication class wrong is refused exactly as hard as one aimed at a forbidden address.
 *
 * `GET /repos/{owner}/{repo}/pulls` is the only operation carrying caller-shaped segments, and
 * they are not caller-supplied: they come from an entry of the live installation listing. The
 * placeholders are spelled `{verified_owner}` / `{verified_repo}` in the architecture record for
 * that reason; here they keep GitHub's spelling so the declared path list can be compared to this
 * table by a test.
 */
export const GITHUB_TRANSPORT_OPERATIONS: readonly GitHubOperationPolicy[] = Object.freeze([
  Object.freeze({
    id: "read-installation",
    method: "GET",
    pathTemplate: "/app/installations/{installation_id}",
    auth: "app",
    accept: GITHUB_ACCEPT_MEDIA_TYPE,
  }),
  Object.freeze({
    id: "mint-installation-token",
    method: "POST",
    pathTemplate: "/app/installations/{installation_id}/access_tokens",
    auth: "app",
    accept: GITHUB_ACCEPT_MEDIA_TYPE,
  }),
  Object.freeze({
    id: "list-installation-repositories",
    method: "GET",
    pathTemplate: "/installation/repositories",
    auth: "installation",
    accept: GITHUB_ACCEPT_MEDIA_TYPE,
  }),
  Object.freeze({
    id: "list-open-pull-requests",
    method: "GET",
    pathTemplate: "/repos/{owner}/{repo}/pulls",
    auth: "installation",
    accept: GITHUB_ACCEPT_MEDIA_TYPE,
  }),
] as const);

/** One candidate request, as the firewall sees it. Every field participates in the decision. */
export interface GitHubOperationCandidate {
  readonly method: string;
  readonly pathTemplate: string;
  readonly auth: string;
  readonly accept: string;
}

/**
 * MAY THIS TRANSPORT OPERATION EXIST?
 *
 * Deny by default: a candidate is permitted only when some row of the table matches ALL FOUR
 * fields. Exported because a guard nobody can call is a guard nobody can prove — a test hands this
 * function wrong methods, wrong classes, forbidden addresses and diff media types and requires
 * every one to be refused.
 *
 * It is deliberately NOT an authorization check. See the header.
 */
export function isPermittedGitHubOperation(candidate: GitHubOperationCandidate): boolean {
  return GITHUB_TRANSPORT_OPERATIONS.some(
    (op) =>
      op.method === candidate.method &&
      op.pathTemplate === candidate.pathTemplate &&
      op.auth === candidate.auth &&
      op.accept === candidate.accept,
  );
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The GitHub transport is server-only.");
  }
}

function fail(failure: GitHubFailure["failure"], reason: string): GitHubFailure {
  return { ok: false, failure, reason };
}

/**
 * Map an HTTP status onto a failure class.
 *
 * `404` IS `installation`, NOT `auth`. GitHub returns it both for an installation that never
 * existed and for one that has been uninstalled, and neither says anything is wrong with the App's
 * own credential. Reporting it as `auth` would send an operator to check the private key over a
 * fact about an organization's choice.
 *
 * `403` is `auth` rather than `permission`: an installation-authenticated read that GitHub refuses
 * concerns the credential presented, and a permission gap is reported by the availability
 * authority long before a request is issued.
 */
function classifyStatus(status: number): GitHubFailure {
  if (status === 401) return fail("auth", "github-rejected-app-credential");
  if (status === 403) return fail("auth", "github-refused-app");
  if (status === 404) return fail("installation", "installation-not-found");
  if (status === 429) return fail("transport", "github-rate-limited");
  if (status >= 500) return fail("transport", `github-unavailable-${status}`);
  return fail("malformed", `github-unexpected-status-${status}`);
}

/**
 * A parsed JSON body, or a malformed failure. GitHub's error payloads echo nothing sensitive here,
 * and this function returns none of the body regardless — only a classified outcome.
 */
async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * A repository path segment GitHub could actually have produced.
 *
 * Owner and repository names are letters, digits, hyphen, underscore and dot. This is NOT the
 * primary defence — the segments come out of GitHub's own listing, never from a caller — it is the
 * one that still holds if a future caller forgets that.
 */
const SEGMENT = /^[A-Za-z0-9._-]{1,100}$/;

interface IssueInput {
  readonly operation: GitHubOperationPolicy;
  /** Filled into the operation's own template. Never a path, never a URL. */
  readonly path: string;
  readonly credential: string;
  readonly query?: Readonly<Record<string, string>>;
  readonly deps: GitHubTransportDeps;
}

type Issued = { readonly ok: true; readonly body: unknown } | GitHubFailure;

/**
 * THE ONE PLACE A REQUEST LEAVES THIS PROCESS.
 *
 * Every exported call funnels through here, and here consults the firewall before spending
 * anything. A caller cannot reach `fetch` from this module by any other route.
 */
async function issue(input: IssueInput): Promise<Issued> {
  assertServerOnly();

  const { operation } = input;

  /* DENY BY DEFAULT — before a socket is opened and before a credential is presented. */
  if (
    !isPermittedGitHubOperation({
      method: operation.method,
      pathTemplate: operation.pathTemplate,
      auth: operation.auth,
      accept: operation.accept,
    })
  ) {
    return fail("malformed", "github-operation-not-permitted");
  }

  const url = new URL(`${GITHUB_API_ORIGIN}${input.path}`);
  for (const [key, value] of Object.entries(input.query ?? {})) {
    url.searchParams.set(key, value);
  }

  const doFetch = input.deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await doFetch(url.toString(), {
      method: operation.method,
      headers: {
        /*
         * The pinned JSON media type. `application/vnd.github.diff` and its relatives turn a
         * metadata endpoint into a source-content endpoint at IDENTICAL permission — only the
         * header differs — so the header is part of the firewall key rather than a detail.
         */
        Accept: operation.accept,
        Authorization: `Bearer ${input.credential}`,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "hebun-ai",
      },
      signal: controller.signal,
      /* A redirect from an API host is not something to follow while carrying a credential. */
      redirect: "manual",
      cache: "no-store",
    });

    if (!response.ok) return classifyStatus(response.status);

    const body = await readJson(response);
    if (body === null) return fail("malformed", "github-response-not-json");
    return { ok: true, body };
  } catch {
    /* DNS, TLS, timeout, connection reset — NOTHING is known about the provider's state. */
    return fail("transport", "github-unreachable");
  } finally {
    clearTimeout(timer);
  }
}

/** A positive, safe integer installation id, or `null`. */
function installationSegment(installationId: number): string | null {
  if (!Number.isSafeInteger(installationId) || installationId <= 0) return null;
  return String(installationId);
}

/* ── APP-AUTHENTICATED OPERATIONS ───────────────────────────────────────────── */

export type GitHubInstallationFetch =
  | { readonly ok: true; readonly body: Record<string, unknown> }
  | GitHubFailure;

/**
 * READ ONE INSTALLATION, AUTHENTICATED AS THE APP.
 *
 * `installationId` is a NUMBER by the time it reaches here. The route parses and bounds the
 * untrusted query parameter before calling, so no caller-supplied string can be interpolated into
 * a URL path from this module — the path is built from a validated integer and a constant origin.
 *
 * The returned `body` is GitHub's raw object and goes NOWHERE except the verifier, which
 * normalises it. No surface, no log and no persisted row ever sees it.
 */
export async function fetchInstallation(
  installationId: number,
  appJwt: string,
  deps: GitHubTransportDeps = {},
): Promise<GitHubInstallationFetch> {
  const segment = installationSegment(installationId);
  if (!segment) return fail("malformed", "installation-id-not-a-positive-integer");

  const operation = GITHUB_TRANSPORT_OPERATIONS[0]!;
  const issued = await issue({
    operation,
    path: `/app/installations/${segment}`,
    credential: appJwt,
    deps,
  });
  if (!issued.ok) return issued;

  const body = asObject(issued.body);
  if (!body) return fail("malformed", "github-response-not-an-object");
  return { ok: true, body };
}

export type GitHubTokenMint =
  | { readonly ok: true; readonly token: string; readonly permissions: Record<string, unknown> }
  | GitHubFailure;

/**
 * MINT AN INSTALLATION ACCESS TOKEN — the only place one is ever created.
 *
 * ── LEAST PRIVILEGE IS REQUESTED, NEVER ASSUMED ─────────────────────────────
 *
 * GitHub's documented body parameters may NARROW a token and can never widen it: "cannot be
 * granted permissions that the app was not granted". So the request asks for exactly the two
 * permissions this capability declares. A leaked token is then bounded by the CAPABILITY rather
 * than by the whole installation.
 *
 * Whether GitHub honours that narrowing for this App's grant is a REAL-PROVIDER question. The
 * caller compares what came back against what was asked for; this function does not pretend.
 *
 * ── THE TOKEN IS RETURNED EXACTLY ONE LEVEL ─────────────────────────────────
 *
 * To `github-authorized-call.server.ts`, which hands it to a callback and lets it fall out of
 * scope. It is never persisted, never cached, never logged, and never returned to a seam. The
 * failure path returns a classified reason and NEVER the response body, because that body is
 * where the token lives.
 */
export async function mintInstallationAccessToken(
  installationId: number,
  appJwt: string,
  requestedPermissions: Readonly<Record<string, string>>,
  deps: GitHubTransportDeps = {},
): Promise<GitHubTokenMint> {
  const segment = installationSegment(installationId);
  if (!segment) return fail("malformed", "installation-id-not-a-positive-integer");

  const operation = GITHUB_TRANSPORT_OPERATIONS[1]!;

  /*
   * The body is built here rather than passed through `issue`, because `issue` must never accept a
   * caller-shaped body: a request body is another way to change what an operation does.
   */
  assertServerOnly();
  if (
    !isPermittedGitHubOperation({
      method: operation.method,
      pathTemplate: operation.pathTemplate,
      auth: operation.auth,
      accept: operation.accept,
    })
  ) {
    return fail("malformed", "github-operation-not-permitted");
  }

  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await doFetch(`${GITHUB_API_ORIGIN}/app/installations/${segment}/access_tokens`, {
      method: operation.method,
      headers: {
        Accept: operation.accept,
        Authorization: `Bearer ${appJwt}`,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "hebun-ai",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ permissions: requestedPermissions }),
      signal: controller.signal,
      redirect: "manual",
      cache: "no-store",
    });

    if (!response.ok) return classifyStatus(response.status);

    const body = asObject(await readJson(response));
    if (!body) return fail("malformed", "github-response-not-an-object");

    const token = body["token"];
    if (typeof token !== "string" || token.length === 0) {
      /* No token, and DELIBERATELY no echo of the body: this is the response that carries one. */
      return fail("malformed", "github-token-response-carried-no-token");
    }

    const permissions = asObject(body["permissions"]) ?? {};
    return { ok: true, token, permissions };
  } catch {
    return fail("transport", "github-unreachable");
  } finally {
    clearTimeout(timer);
  }
}

/* ── INSTALLATION-AUTHENTICATED OPERATIONS ──────────────────────────────────── */

export type GitHubListFetch = { readonly ok: true; readonly body: unknown } | GitHubFailure;

/**
 * LIST THE REPOSITORIES THIS INSTALLATION COVERS.
 *
 * Bounded at Hebun's own page size, which is below GitHub's maximum on purpose: a read bounded by
 * the provider's maximum is a data export waiting for a caller. One page — a second page is a
 * decision about how much of an organization Hebun holds in memory, and this release does not make
 * it.
 */
export async function listInstallationRepositories(
  installationToken: string,
  deps: GitHubTransportDeps = {},
): Promise<GitHubListFetch> {
  const operation = GITHUB_TRANSPORT_OPERATIONS[2]!;
  return issue({
    operation,
    path: "/installation/repositories",
    credential: installationToken,
    query: { per_page: String(MAX_REPOSITORIES_PER_PAGE) },
    deps,
  });
}

/**
 * LIST OPEN PULL REQUESTS FOR ONE REPOSITORY.
 *
 * `owner` and `repo` MUST come from an entry of the live installation listing. A caller-supplied
 * pair would be a caller establishing repository authority, which is the whole thing
 * `read-repository-pull-requests.server.ts` exists to prevent — the segment check below is the
 * backstop, not the defence.
 *
 * `state=open` is pinned. There is no `state` parameter on this function: a closed-pull-request
 * history is a different question with a different volume, and it is not this capability.
 */
export async function listOpenPullRequests(
  owner: string,
  repo: string,
  installationToken: string,
  deps: GitHubTransportDeps = {},
): Promise<GitHubListFetch> {
  if (!SEGMENT.test(owner) || !SEGMENT.test(repo)) {
    return fail("malformed", "repository-segment-not-usable");
  }

  const operation = GITHUB_TRANSPORT_OPERATIONS[3]!;
  return issue({
    operation,
    path: `/repos/${owner}/${repo}/pulls`,
    credential: installationToken,
    query: { state: "open", per_page: String(MAX_PULL_REQUESTS_PER_PAGE) },
    deps,
  });
}
