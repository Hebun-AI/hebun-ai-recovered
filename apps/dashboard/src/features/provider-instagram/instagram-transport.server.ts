/*
 * provider-instagram/instagram-transport.server.ts — the ONLY place Hebun talks to Instagram.
 *
 * ── NO GENERIC REQUEST ──────────────────────────────────────────────────────
 *
 * Every request is built from `INSTAGRAM_ALLOWED_OPERATIONS` and its declared parameter list. There
 * is no `request(path)` a caller could aim, and no parameter name that is not on the operation's own
 * allow-list. The released YouTube transport uses exactly this shape and for exactly this reason.
 *
 * ── THE TOKEN TRAVELS IN A HEADER, NEVER IN THE URL ─────────────────────────
 *
 * Instagram accepts `access_token` as a query parameter. This transport refuses to use it.
 * A secret in a URL reaches proxy logs, error reports and browser history, and this repository has
 * already recorded that lesson once. `Authorization: Bearer` keeps it in a header that nothing here
 * logs, and the plaintext never leaves the callback frame the credential authority opened.
 *
 * ── IT READS AND CANNOT WRITE ───────────────────────────────────────────────
 *
 * One verb, hard-coded: `GET`. No body is ever constructed. A publish, a comment or a message would
 * each need a POST this file cannot express, and `INSTAGRAM_FORBIDDEN_FRAGMENTS` is asserted against
 * this source so that adding one fails a test rather than shipping.
 *
 * Server-only.
 */
import type { FetchLike } from "@/features/provider-youtube/youtube-transport.server";
import {
  INSTAGRAM_ACCOUNT_FIELDS,
  INSTAGRAM_ALLOWED_OPERATIONS,
  INSTAGRAM_API_ORIGIN,
  INSTAGRAM_API_VERSION,
  type InstagramAccountView,
  type InstagramFailureClass,
  type InstagramOperationId,
  type InstagramResult,
} from "./contracts";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface InstagramTransportDeps {
  /* The released transport's own injection shape, reused so a caller can hand ONE fake to both. */
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The Instagram transport is server-only.");
  }
}

function fail(failure: InstagramFailureClass, reason: string): InstagramResult<never> {
  return { ok: false, failure, reason };
}

/**
 * Classify an HTTP status and Instagram's own error code into this provider's closed vocabulary.
 *
 * INSTAGRAM RETURNS 400 FOR SEVERAL UNRELATED FACTS, so the body's error code is consulted rather
 * than the status alone. A wrong-account-type refusal and an expired token are both 400s and must
 * not be reported as the same thing: one is a permanent property of the account, the other is a
 * credential that can be replaced.
 */
function classify(status: number, code: number | null, subcode: number | null): InstagramResult<never> {
  if (status === 429) return fail("rate-limited", "instagram-rate-limited");
  if (status >= 500) return fail("transport", `instagram-${status}`);
  if (status === 404) return fail("not-found", "instagram-account-not-found");

  /* 190 is the documented OAuth-error family: expired, revoked or invalid token. */
  if (code === 190) return fail("auth", "instagram-token-rejected");
  /* 10 and 200 are the permission families — the token is real, the grant does not cover this. */
  if (code === 10 || code === 200) return fail("scope", "instagram-scope-insufficient");
  /*
   * ── 100/33 IS NOT A STATEMENT ABOUT THE ACCOUNT ─────────────────────────
   *
   * This used to be read as "the account is not professional", and a real ceremony proved that
   * wrong: a genuine Business account was refused with that label while Meta was answering
   * `account_type: "BUSINESS"` for the very same token. Meta's own text for 100/33 is
   * "Object with ID does not exist, cannot be loaded due to missing permissions, or does not
   * support this operation" — three different facts about a NODE, and none of them about the
   * account's type.
   *
   * So it is reported for what it is: the node Hebun asked for was not available to this token.
   * Whether the account is professional is answered by `account_type`, which this API returns and
   * which the verifier reads — not inferred from a request that failed to address anything.
   */
  if (code === 100 && subcode === 33) {
    return fail("not-found", "instagram-node-unavailable");
  }
  if (status === 401 || status === 403) return fail("auth", `instagram-${status}`);
  return fail("malformed", `instagram-unclassified-${status}`);
}

function numberOrNull(value: unknown): number | null {
  /*
   * ABSENT IS NOT ZERO. Instagram omits a count it will not report; coalescing that to 0 would
   * invent a fact the provider declined to state.
   */
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^[0-9]+$/.test(value)) return Number(value);
  return null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

async function call(
  operation: InstagramOperationId,
  accountId: string,
  params: Readonly<Record<string, string>>,
  accessToken: string,
  deps: InstagramTransportDeps,
): Promise<InstagramResult<unknown>> {
  assertServerOnly();
  const policy = INSTAGRAM_ALLOWED_OPERATIONS.find((op) => op.id === operation);
  if (!policy) return fail("malformed", "operation-not-permitted");

  const path = policy.path.replace("{account-id}", encodeURIComponent(accountId));
  const url = new URL(`${INSTAGRAM_API_ORIGIN}/${INSTAGRAM_API_VERSION}${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (!(policy.params as readonly string[]).includes(name)) {
      return fail("malformed", "parameter-not-permitted");
    }
    url.searchParams.set(name, value);
  }

  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        /* THE SECRET LIVES HERE, NOT IN THE URL. */
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
    });
  } catch {
    return fail("transport", "instagram-unreachable");
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return response.ok
      ? fail("malformed", "instagram-body-unparseable")
      : classify(response.status, null, null);
  }

  if (!response.ok) {
    const error = (body as { error?: { code?: unknown; error_subcode?: unknown } })?.error;
    const code = typeof error?.code === "number" ? error.code : null;
    const subcode = typeof error?.error_subcode === "number" ? error.error_subcode : null;
    return classify(response.status, code, subcode);
  }
  return { ok: true, value: body };
}

/**
 * Read one professional account by its Instagram id.
 *
 * The account id is the authorization's own, parsed from the canonical subject reference. A username
 * is never accepted here: it is mutable, and an authorization that could be redirected by a rename
 * would not be binding a subject at all.
 */
export async function readAccount(
  accessToken: string,
  accountId: string,
  deps: InstagramTransportDeps = {},
): Promise<InstagramResult<InstagramAccountView>> {
  const result = await call(
    "account.read",
    accountId,
    { fields: INSTAGRAM_ACCOUNT_FIELDS.join(",") },
    accessToken,
    deps,
  );
  if (!result.ok) return result;

  const node = result.value as Record<string, unknown>;
  const id = stringOrNull(node?.id);
  /*
   * THE ID IS THE ONE FIELD THAT MUST BE PRESENT. Everything else may legitimately be withheld and
   * is carried as `null`; a response with no id is not an account, and reporting one would attach
   * facts to a subject Instagram never confirmed.
   */
  if (id === null) return fail("malformed", "instagram-account-id-missing");
  if (id !== accountId) return fail("malformed", "instagram-account-id-mismatch");

  return {
    ok: true,
    value: {
      accountId: id,
      username: stringOrNull(node.username),
      accountType: stringOrNull(node.account_type),
      followersCount: numberOrNull(node.followers_count),
      followsCount: numberOrNull(node.follows_count),
      mediaCount: numberOrNull(node.media_count),
    },
  };
}

/**
 * Read the account THIS TOKEN belongs to, at Meta's documented `/me`.
 *
 * ── WHY THIS TAKES NO ACCOUNT ID ────────────────────────────────────────────
 *
 * Because there is no id it could be given that would be safe to trust. Meta's node carries two:
 * `id`, the app-scoped one, and `user_id`, the Instagram professional account id. They are
 * different values, the token response supplies `user_id`, and a ceremony that used it as the path
 * was answered with a node error that Hebun then misread as a statement about the account.
 *
 * `/me` removes the choice. The account it returns is the account the token authorizes, by
 * construction, and the `id` it reports is the identity a connection is bound by — so identity is
 * the PROVIDER'S answer rather than something a caller supplied and this function agreed with.
 *
 * THE ID-MISMATCH GUARD IS NOT WEAKENED BY ITS ABSENCE HERE. That guard exists on `readAccount` to
 * make an authorization binding: a subject named in an authorization must be the subject that
 * answers. There is no supplied subject on this path to disagree with, so the guard has nothing to
 * check — and it remains exactly as it was on the by-id read that observation uses.
 */
export async function readOwnAccount(
  accessToken: string,
  deps: InstagramTransportDeps = {},
): Promise<InstagramResult<InstagramAccountView>> {
  const result = await call(
    "account.read.self",
    /* No account id is interpolated: `/me` carries no `{account-id}` placeholder. */
    "",
    { fields: INSTAGRAM_ACCOUNT_FIELDS.join(",") },
    accessToken,
    deps,
  );
  if (!result.ok) return result;

  const node = result.value as Record<string, unknown>;
  const id = stringOrNull(node?.id);
  /* Same rule as the by-id read: no id, no account. */
  if (id === null) return fail("malformed", "instagram-account-id-missing");

  return {
    ok: true,
    value: {
      accountId: id,
      username: stringOrNull(node.username),
      accountType: stringOrNull(node.account_type),
      followersCount: numberOrNull(node.followers_count),
      followsCount: numberOrNull(node.follows_count),
      mediaCount: numberOrNull(node.media_count),
    },
  };
}
