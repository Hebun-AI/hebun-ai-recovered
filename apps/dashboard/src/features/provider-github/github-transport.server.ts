/*
 * provider-github/github-transport.server.ts — THE ONLY PLACE HEBUN TALKS TO GITHUB.
 *
 * ── IT KNOWS EXACTLY ONE ENDPOINT ────────────────────────────────────────────
 *
 * `GET /app/installations/{installation_id}`, and nothing else. There is no repository endpoint,
 * no pull-request endpoint, no contents endpoint and no token-minting endpoint in this file,
 * because GITHUB-2 establishes a CONNECTION and reads no engineering data.
 *
 * That is a stronger statement than a policy: the transport has no address to send a data read to.
 * The capability's allow list lives in `contracts.ts` and will be consumed by the phase that
 * builds the data seam; this module deliberately does not implement it yet, so there is no
 * unused, untested request builder sitting in production waiting to be called.
 *
 * ── THERE IS NO INSTALLATION TOKEN HERE EITHER ───────────────────────────────
 *
 * `POST /app/installations/{id}/access_tokens` is what mints the credential that can actually read
 * a repository. This phase never needs one — installation identity comes from the App JWT alone —
 * so it is absent. Adding it would create the ability to read data in the phase that promised not
 * to, and a token nobody asked for is a token that eventually gets stored.
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
 * `403` is `auth` here rather than `permission`: the only call this module makes needs no
 * repository permission at all, so a refusal can only concern the App itself — a suspended App, or
 * a key GitHub no longer honours.
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
async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

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
  assertServerOnly();

  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    return fail("malformed", "installation-id-not-a-positive-integer");
  }

  const doFetch = deps.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await doFetch(`${GITHUB_API_ORIGIN}/app/installations/${installationId}`, {
      method: "GET",
      headers: {
        /*
         * The pinned JSON media type. A `diff` or `raw` type on a data endpoint is how a metadata
         * read becomes a source-content read; this endpoint has no such variant, and the header is
         * pinned anyway so the habit is established before the data seam exists.
         */
        Accept: GITHUB_ACCEPT_MEDIA_TYPE,
        Authorization: `Bearer ${appJwt}`,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "hebun-ai",
      },
      signal: controller.signal,
      /* A redirect from an API host is not something to follow while carrying an App assertion. */
      redirect: "manual",
      cache: "no-store",
    });

    if (!response.ok) return classifyStatus(response.status);

    const body = await readJson(response);
    if (!body) return fail("malformed", "github-response-not-an-object");
    return { ok: true, body };
  } catch {
    /* DNS, TLS, timeout, connection reset — NOTHING is known about the installation. */
    return fail("transport", "github-unreachable");
  } finally {
    clearTimeout(timer);
  }
}
