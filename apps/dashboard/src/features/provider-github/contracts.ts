/*
 * provider-github/contracts.ts — the typed vocabulary of "this tenant installed Hebun's GitHub App
 * on their organization" (GITHUB-1).
 *
 * THE QUESTIONS GITHUB-1 ANSWERS, AND THE ONES IT REFUSES:
 *
 *   ANSWERED   What permission would Hebun request, what must GitHub have granted before a
 *              capability may be claimed, and what shape may a read return?
 *   REFUSED    Is a GitHub App registered? (No external console act belongs to a repository.)
 *   REFUSED    Is an organization installed? (GITHUB-2 — no installation exists.)
 *   REFUSED    May Hebun read a repository? (Nothing here performs I/O. See below.)
 *   REFUSED    May Hebun write anything at GitHub? (No write permission is requested, ever.)
 *
 * ── THIS FILE PERFORMS NO I/O, AND THAT IS STRUCTURAL ────────────────────────
 *
 * There is no `fetch`, no client, no transport, no credential, no private key, no JWT and no
 * token in this module or anywhere under `provider-github`. It is pure data and pure functions.
 * A contract that cannot call anything cannot accidentally become a connection, which is why the
 * catalog entry it feeds is honest before GITHUB-2 exists.
 *
 * ── WHY THIS IS NOT `features/providers/github` ──────────────────────────────
 *
 * `features/providers/github` is the SIMULATION provider — World B. It declares
 * `simulation: true`, `supportedExecutionModes: ["simulation"]`, and serves deterministic
 * fixtures for `hebun-ai/dashboard` including issues, workflows and releases. None of that is a
 * connection, none of it is a grant, and none of it may ever satisfy real-provider truth.
 *
 * The two worlds are kept apart by their KEYS, not by a convention. World B's provider id is the
 * bare string `github`. This provider's catalog key is `github-organization`, so no literal is
 * shared, a log line names exactly one world, and a firewall can assert the separation
 * mechanically instead of a reviewer noticing it. The key also states the released Director
 * decision: GitHub is an ORGANIZATIONAL provider, never a user-personal OAuth connection.
 *
 * ── AUTHORIZATION IS A GITHUB APP INSTALLATION, NOT OAUTH ────────────────────
 *
 * Verified against GitHub's current documentation, not from memory:
 *
 *   - An installation access token is minted by POSTing to
 *     `/app/installations/{id}/access_tokens` with a JWT, and "The installation access token will
 *     expire after 1 hour."
 *   - The JWT "must be signed using the `RS256` algorithm", its expiry "must be no more than 10
 *     minutes into the future", and `iss` is the App's client id or application id.
 *   - `GET /app/installations/{id}` requires a JWT and returns `account`, `repository_selection`,
 *     `permissions`, `events` and `suspended_at`.
 *   - `GET /installation/repositories` requires an INSTALLATION token and returns
 *     `repository_selection` plus the repositories the installation may actually see.
 *   - The Setup URL receives `installation_id`, and GitHub states plainly: "Bad actors can hit
 *     this URL with a spoofed `installation_id`. Therefore, you should not rely on the validity of
 *     the `installation_id` parameter."
 *
 * That last sentence is why `INSTALLATION PRESENCE IS NOT A CONNECTION` is written into the types
 * below rather than into a comment somebody may skip: an installation id arriving in a query
 * string is a CLAIM, and only a JWT-authenticated read of `GET /app/installations/{id}` turns it
 * into a fact.
 *
 * ── THERE IS NO TENANT CREDENTIAL TO PERSIST ─────────────────────────────────
 *
 * Google needed `integration_credentials` because the tenant's grant IS a refresh token, held by
 * Hebun. GitHub's model is different and the difference is load-bearing:
 *
 *   deployment-owned   App id + App private key      env, never a tenant row
 *   tenant-owned       installation id + org identity `integrations` columns that already exist
 *   ephemeral          installation access token     minted per use, 1 hour, NEVER stored
 *
 * So GITHUB-2 needs NO row in `integration_credentials`, and inventing `oauth_access` /
 * `oauth_refresh` records for a model that has neither would be a false statement about what Hebun
 * holds. The installation id is a tenant-scoped identifier, not a secret; it lands in
 * `integrations.external_account_id` alongside the organization login as its label — both are
 * existing columns, so this contract needs no schema.
 *
 * ── PERMISSIONS ARE NOT OAUTH SCOPES, AND THEY NORMALIZE ANYWAY ──────────────
 *
 * GitHub grants a MAP — `{"metadata": "read", "pull_requests": "read"}` — where OAuth grants a
 * list. `integrations.scopes` is a `jsonb` `string[]`, and the availability seam compares it by
 * exact membership (`required.every((s) => granted.includes(s))`). Flattening each entry to
 * `name:level` in GITHUB'S OWN SPELLING preserves both halves of the question the seam must
 * answer — WHICH permission, at WHAT level — inside the released column, with no migration.
 *
 * `requested` and `granted` stay two different sets, deliberately. `GITHUB_REQUESTED_PERMISSIONS`
 * is what the App registration asks for; `GITHUB_REQUIRED_GRANTED_PERMISSIONS` is what must come
 * back before anything may be claimed. An organization owner may install with fewer repositories
 * or an administrator may later reduce a permission, and comparing a grant against what Hebun
 * hoped for would pass while proving nothing.
 *
 * Pure types and frozen values. No I/O, no secrets, no database, no clock.
 */

/* ── Identity ───────────────────────────────────────────────────────────────── */

/** The catalog key. Distinct from World B's `github` on purpose — see the header. */
export const GITHUB_PROVIDER_KEY = "github-organization" as const;

/**
 * THE ONLY ACCOUNT TYPE THIS PROVIDER ACCEPTS, in GitHub's own spelling.
 *
 * GitHub installs an App on a `User` or an `Organization` and reports which in
 * `installation.account.type`. A personal installation is a different product decision with a
 * different tenancy story, so it is refused rather than tolerated: an organizational provider that
 * silently accepted a personal account would bind a company's tenant to one person's repositories.
 */
export const GITHUB_ORGANIZATION_ACCOUNT_TYPE = "Organization" as const;

/** GitHub's API origin. A constant, so no caller can point a future transport somewhere else. */
export const GITHUB_API_ORIGIN = "https://api.github.com" as const;

/* ── Permissions ────────────────────────────────────────────────────────────── */

/**
 * The permission levels GitHub can report. `admin` exists on some permissions; it is listed so a
 * granted map carrying one is UNDERSTOOD and refused, rather than silently normalizing to nothing.
 */
export type GitHubPermissionLevel = "read" | "write" | "admin";

export const GITHUB_PERMISSION_LEVELS: readonly GitHubPermissionLevel[] = Object.freeze([
  "read",
  "write",
  "admin",
]);

/**
 * WHAT THE APP REGISTRATION ASKS FOR. Two entries, both read.
 *
 * `metadata:read` is the repository-identity permission: `GET /repos/{owner}/{repo}`,
 * `GET /orgs/{org}/repos`, languages, topics, tags. `pull_requests:read` is the only permission
 * that can list pull requests at all.
 *
 * `contents:read` IS DELIBERATELY ABSENT, and this is the single most important line in the file.
 * GitHub's permission reference places `GET /repos/{owner}/{repo}/commits` and
 * `GET /repos/{owner}/{repo}/contents/{path}` under the SAME permission. So commit listing cannot
 * be bought without buying source-file access, and the released Director decision is that commit
 * metadata is deferred rather than that source content is acceptable.
 */
export const GITHUB_REQUESTED_PERMISSIONS: readonly string[] = Object.freeze([
  "metadata:read",
  "pull_requests:read",
]);

/**
 * WHAT MUST COME BACK BEFORE A CONNECTION MAY BE CALLED CONNECTED.
 *
 * Only `metadata:read`. An installation that granted metadata and nothing else is a real, honest
 * connection to a real organization — it simply cannot answer the repository-activity capability,
 * and the availability seam will say `degraded` with a scope-gap reason. Requiring the capability's
 * full permission set here would instead refuse the CONNECTION, which would be a claim that the
 * organization is not connected when it plainly is.
 *
 * This is the same split the availability seam already enforces for Google: minimum-to-connect is
 * not the same question as covers-this-capability.
 */
export const GITHUB_REQUIRED_GRANTED_PERMISSIONS: readonly string[] = Object.freeze([
  "metadata:read",
]);

/**
 * PERMISSION NAMES THIS PROVIDER MAY NEVER REQUEST — a closed deny list, asserted by a test.
 *
 * Every one of them is a capability the released product does not claim. `contents` and `workflows`
 * reach source files; `actions`, `checks`, `statuses` and `deployments` reach CI; `issues` and
 * `pages` are separate products; `administration`, `members`, `organization_administration` and
 * `secrets` are governance and credential surfaces that a read capability has no business holding.
 *
 * A deny list is not the primary defence — `GITHUB_REQUESTED_PERMISSIONS` is, because it is an
 * exhaustive allow list. This exists so that WIDENING the allow list to one of these names fails a
 * test instead of passing review.
 */
export const GITHUB_FORBIDDEN_PERMISSION_NAMES: readonly string[] = Object.freeze([
  "actions",
  "administration",
  "checks",
  "contents",
  "deployments",
  "environments",
  "issues",
  "members",
  "organization_administration",
  "organization_secrets",
  "packages",
  "pages",
  "secrets",
  "security_events",
  "statuses",
  "workflows",
]);

/**
 * Split a normalized `name:level` pair. Returns `null` for anything that is not one.
 *
 * A permission string is data that reaches this function from a provider response, so it is parsed
 * rather than trusted: an unrecognized level is not a level, and a name with no level is not a
 * permission.
 */
export function parseGitHubPermission(
  permission: string,
): { readonly name: string; readonly level: GitHubPermissionLevel } | null {
  const separator = permission.indexOf(":");
  if (separator <= 0) return null;
  const name = permission.slice(0, separator);
  const level = permission.slice(separator + 1);
  if (name.length === 0) return null;
  if (!GITHUB_PERMISSION_LEVELS.includes(level as GitHubPermissionLevel)) return null;
  return { name, level: level as GitHubPermissionLevel };
}

/** `true` when the permission grants more than reading. Used to keep a write out of the catalog. */
export function isWritePermission(permission: string): boolean {
  const parsed = parseGitHubPermission(permission);
  return parsed !== null && parsed.level !== "read";
}

/**
 * NORMALIZE GITHUB'S PERMISSION MAP INTO THE RELEASED `integrations.scopes` SHAPE.
 *
 * GitHub answers `{"metadata": "read", "pull_requests": "read"}`. The column is a `string[]` and
 * the availability seam compares by exact membership, so each entry becomes `name:level`.
 *
 * ── WHY EVERY INPUT IS TREATED AS HOSTILE ─────────────────────────────────────
 *
 * This function's argument is a parsed provider response. The parameter type does not guarantee the
 * caller used `JSON.parse`, and INT-4 learned this exact lesson the hard way with a bare map lookup
 * that reached the prototype chain. So: own properties only, string values only, recognized levels
 * only, and anything else is DROPPED rather than normalized into a permission Hebun never received.
 *
 * `Object.keys` IS THE MECHANISM, AND IT IS THE ONLY ONE. It enumerates own enumerable properties
 * and nothing else, so a permission borne on the prototype is INVISIBLE here rather than rejected
 * downstream. An `Object.hasOwn` re-check was written first and then deleted: after `Object.keys`
 * it can never be false, so it could not be made to bite, and a line whose removal changes nothing
 * is documentation wearing a guard's clothes. `for...in` WOULD walk the chain — that is the
 * mutation the bite-proof applies, and it fails.
 *
 * Sorted, so a stored grant is stable and two identical grants compare equal.
 */
export function normalizeGrantedPermissions(
  permissions: Readonly<Record<string, unknown>> | null | undefined,
): readonly string[] {
  if (!permissions || typeof permissions !== "object") return Object.freeze([]);
  const normalized: string[] = [];
  for (const name of Object.keys(permissions)) {
    if (name.length === 0) continue;
    const level = permissions[name];
    if (typeof level !== "string") continue;
    if (!GITHUB_PERMISSION_LEVELS.includes(level as GitHubPermissionLevel)) continue;
    normalized.push(`${name}:${level}`);
  }
  return Object.freeze([...new Set(normalized)].sort());
}

/**
 * Every required permission is in the granted set.
 *
 * EXACT MATCH, NOT LEVEL SUBSUMPTION. `metadata:write` does NOT satisfy `metadata:read` here, even
 * though GitHub would allow the read. That is deliberate: this provider never requests a write, so
 * a grant carrying one is a grant Hebun did not ask for, and treating it as satisfying a read
 * requirement would quietly launder an over-broad installation into a compliant one.
 */
export function coversRequiredPermissions(granted: readonly string[]): boolean {
  return GITHUB_REQUIRED_GRANTED_PERMISSIONS.every((required) => granted.includes(required));
}

/* ── The first capability ───────────────────────────────────────────────────── */

/**
 * THE CAPABILITY KEY.
 *
 * It names repository ACTIVITY — repository identity and pull-request metadata — and nothing else.
 * `github.repository.read` would be a promise broken the first time somebody asked it for a file,
 * and `github.read` would be a promise broken immediately.
 */
export const GITHUB_REPOSITORY_ACTIVITY_CAPABILITY = "github.repository.activity.read" as const;

/**
 * THE PERMISSIONS THIS CAPABILITY NEEDS. Both, together.
 *
 * The capability is repository identity AND pull-request activity, so a grant carrying only
 * `metadata:read` genuinely cannot answer it. The availability seam reports that as a scope gap —
 * which persists until the organization re-grants — rather than as an outage.
 */
export const GITHUB_REPOSITORY_ACTIVITY_READ_PERMISSIONS: readonly string[] = Object.freeze([
  "metadata:read",
  "pull_requests:read",
]);

/**
 * THE WRITE PERMISSION SET FOR THIS CAPABILITY: EMPTY, AND THAT MEANS SOMETHING.
 *
 * The availability seam treats an empty write list as "no write capability exists" rather than as
 * vacuously satisfied, so this capability reports `writeCapable: false` however generous an
 * organization's installation becomes. A GitHub write is not a permission away; it is a phase away,
 * and it would additionally require a Governance permit that no read can mint.
 */
export const GITHUB_REPOSITORY_ACTIVITY_WRITE_PERMISSIONS: readonly string[] = Object.freeze([]);

/* ── The source-content firewall ────────────────────────────────────────────── */

/**
 * ── WHY THIS SECTION EXISTS, STATED PLAINLY ──────────────────────────────────
 *
 * GitHub's `pull_requests:read` permission is BROADER THAN THIS PRODUCT'S CAPABILITY. Verified
 * against GitHub's permission reference: that one permission also grants
 * `GET /repos/{owner}/{repo}/pulls/{pull_number}/files`, whose response carries a `patch` field,
 * and `GET /repos/{owner}/{repo}/pulls/{pull_number}` will return a full unified diff when asked
 * with a `diff` or `patch` media type. Those are source-code contents.
 *
 * Google's Drive capability did not need a section like this, and the difference is worth naming:
 * `drive.metadata.readonly` cannot download a file, so GOOGLE enforced that boundary and a mistake
 * in Hebun's code could not cross it. GitHub does not offer a permission with that shape. Listing
 * pull requests at all requires a permission that can also read their diffs.
 *
 * So the boundary here is Hebun's to hold, and it was accepted as a Director decision rather than
 * assumed. This is the WEAKER of the two arrangements and it is recorded as such: the released
 * product claims less than the granted provider permission allows, and only these constants stand
 * between them.
 *
 * They are CONTRACT, not transport. GITHUB-1 builds no client, so nothing enforces them yet —
 * `GITHUB-2 must construct every request from this allow list.` A test asserts the list's shape and
 * that no forbidden path is reachable from it; it cannot assert a caller that does not exist.
 */

/**
 * THE INSTALLATION-AUTHENTICATED REQUEST PATHS THIS PROVIDER MAY ISSUE. Deny by default.
 *
 * ── WHAT THIS LIST IS, AND WHAT ENFORCES IT ─────────────────────────────────
 *
 * GITHUB-1 wrote this as "the complete set of paths this provider may ever issue", which was true
 * of a provider that issued none and stopped being true the moment App-authenticated addresses
 * existed: `/app/installations/{id}` was never on it. The runtime boundary is
 * `GITHUB_TRANSPORT_OPERATIONS` in `github-transport.server.ts`, which keys on method, path,
 * AUTHENTICATION CLASS and Accept together and is consulted before every request.
 *
 * This list is now exactly the INSTALLATION-authenticated half of that table, and a test asserts
 * the two agree. Keeping it is the two-readings discipline: the transport consults its table, and
 * a test consults this list plus the forbidden fragments below to prove the table did not quietly
 * grow a member that reaches a file.
 *
 * `{owner}` and `{repo}` are the only placeholders. There is deliberately no
 * `/pulls/{number}/files`, no `/contents/{path}`, no `/git/blobs`, no `/commits`, no `/compare`,
 * no `/tarball` and no `/zipball` — a content read has no address written against it, which is the
 * same discipline `provider-google/contracts.ts` applies by declaring `files.list` and no
 * `alt=media` endpoint.
 */
export const GITHUB_ALLOWED_REQUEST_PATHS: readonly string[] = Object.freeze([
  /* Which repositories this installation may actually see. Installation-token authenticated. */
  "/installation/repositories",
  /* Pull-request metadata for one repository. Never one pull request, never its files. */
  "/repos/{owner}/{repo}/pulls",
]);

/**
 * PATH FRAGMENTS THAT REACH SOURCE CONTENT OR A DEFERRED SURFACE.
 *
 * Redundant with the allow list above by construction, and that redundancy is the point: the allow
 * list is what a caller consults, and this is what a test consults to prove the allow list did not
 * quietly grow a member that reaches a file. If the two ever disagree, the test fails.
 */
export const GITHUB_FORBIDDEN_PATH_FRAGMENTS: readonly string[] = Object.freeze([
  "/actions",
  "/checks",
  "/commits",
  "/compare",
  "/contents",
  "/deployments",
  "/git/",
  "/issues",
  "/pulls/{pull_number}",
  "/statuses",
  "/tarball",
  "/zipball",
]);

/**
 * THE ONLY MEDIA TYPE A REQUEST MAY ASK FOR.
 *
 * `GET /repos/{owner}/{repo}/pulls` returns JSON metadata under `application/vnd.github+json` and a
 * unified DIFF under `application/vnd.github.diff`. The permission is identical; only the header
 * differs. So the header is pinned to one value, and the alternatives are enumerated below so a
 * test can prove the pinned one is not among them.
 */
export const GITHUB_ACCEPT_MEDIA_TYPE = "application/vnd.github+json" as const;

/** Media types that turn a metadata endpoint into a source-content endpoint. */
export const GITHUB_FORBIDDEN_ACCEPT_MEDIA_TYPES: readonly string[] = Object.freeze([
  "application/vnd.github.diff",
  "application/vnd.github.patch",
  "application/vnd.github.raw",
  "application/vnd.github.v3.diff",
  "application/vnd.github.patch+json",
  "application/vnd.github.raw+json",
]);

/** `true` when the path is one this provider may request. Allow list only — never a heuristic. */
export function isAllowedRequestPath(path: string): boolean {
  return GITHUB_ALLOWED_REQUEST_PATHS.includes(path);
}

/* ── What a read may return ─────────────────────────────────────────────────── */

/**
 * ONE REPOSITORY, AS HEBUN SEES IT.
 *
 * A NORMALIZED, PROVIDER-OWNED shape — never GitHub's response object. GitHub's `Repository`
 * resource carries permissions, owner records, clone URLs, licence bodies, security-and-analysis
 * settings and forty URL templates, and returning it raw would put every field GitHub adds in
 * future onto a Hebun surface without anybody deciding.
 *
 * `isPrivate` is reported because a signal that silently mixed public and private repositories
 * would be read as one number meaning two things.
 */
export interface GitHubRepositoryView {
  /** GitHub's numeric id. Provider-derived — it carries no Hebun authority of any kind. */
  readonly repositoryId: number;
  /** `owner/name`, as GitHub spells it. Untrusted provider text. */
  readonly fullName: string;
  readonly isPrivate: boolean;
  readonly isArchived: boolean;
  readonly defaultBranch: string | null;
  readonly updatedAt: string | null;
}

/**
 * ONE PULL REQUEST, AS HEBUN SEES IT — METADATA, AND STRUCTURALLY NOTHING ELSE.
 *
 * There is no `patch`, no `diff`, no `body`, no `files`, no `commits`, no `head.sha` and no
 * `mergeCommitSha` field. A shape with a hole for content invites somebody to fill it, so the hole
 * does not exist: a caller holding this object cannot surface a line of source code, whatever the
 * granted permission would have allowed.
 *
 * `title` and `authorLogin` ARE untrusted provider text and are treated as data on every surface
 * that renders them — never as an instruction, never as markup.
 */
export interface GitHubPullRequestView {
  readonly number: number;
  readonly title: string;
  readonly state: "open" | "closed";
  readonly isDraft: boolean;
  readonly authorLogin: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
}

/**
 * The most repositories or pull requests one read may return.
 *
 * GitHub's own per-page maximum is 100. These are below it on purpose: a read seam bounded by the
 * provider's maximum is a data export waiting for a caller, and every released Hebun listing is
 * bounded well under what the store could serve.
 */
export const MAX_REPOSITORIES_PER_PAGE = 50;
export const MAX_PULL_REQUESTS_PER_PAGE = 50;

/* ── Installation identity ──────────────────────────────────────────────────── */

/**
 * WHICH REPOSITORIES AN INSTALLATION COVERS, in GitHub's own spelling.
 *
 * `all` means the App was installed across the whole organization, including repositories created
 * later. The released Director decision is SELECTED REPOSITORIES ONLY, so `all` is a value this
 * provider must be able to NAME in order to refuse it — a union of one could not express the
 * refusal, and an installation that quietly widened to `all` would look identical to a compliant
 * one.
 */
export type GitHubRepositorySelection = "selected" | "all";

/** The selection this provider accepts. One member, and the type above explains why it is a set. */
export const GITHUB_ACCEPTED_REPOSITORY_SELECTION: readonly GitHubRepositorySelection[] =
  Object.freeze(["selected"]);

/**
 * THE ORGANIZATION AN INSTALLATION IS BOUND TO, as GitHub CONFIRMED it.
 *
 * `accountId` IS THE IDENTITY. It is GitHub's numeric account id and is never reassigned.
 * `accountLogin` is a LABEL: an organization can be renamed, and a freed login can later belong to
 * someone else, so a connection bound to a login would silently follow the name rather than the
 * organization.
 *
 * This shape is CONSTRUCTIBLE ONLY FROM `GET /app/installations/{id}`. It carries no field a query
 * string could supply, which is the type-level statement of GitHub's own warning that a setup-URL
 * `installation_id` must not be relied upon.
 */
export interface GitHubInstallationIdentity {
  readonly installationId: number;
  readonly accountId: number;
  readonly accountLogin: string;
  readonly accountType: typeof GITHUB_ORGANIZATION_ACCOUNT_TYPE;
  readonly repositorySelection: GitHubRepositorySelection;
  /** GitHub's own statement of what it granted. Never what Hebun requested. */
  readonly grantedPermissions: readonly string[];
  /** GitHub suspends an installation without uninstalling it. A suspended one grants nothing. */
  readonly suspended: boolean;
}

/**
 * Why a GitHub call did not succeed — CLASSIFIED, because the classes mean different things to a
 * connection's lifecycle, and confusing them is how a provider outage becomes a false revocation.
 * Modelled on `GoogleFailureClass`, which earned each of its distinctions in production.
 *
 *   auth        GitHub definitively refused the App's own credential (401, bad JWT, unknown app).
 *               Nothing about the organization's installation is implicated.
 *   installation The installation is gone, suspended, or is not the one Hebun holds. The
 *               organization ended the grant — this is the only class that may end a connection.
 *   permission  The installation is live and the granted permissions do not cover the call.
 *   identity    GitHub answered without a usable account id, or with a `User` account where an
 *               `Organization` is required. Nothing can be bound to that.
 *   transport   5xx, 429, secondary rate limit, timeout, DNS, TLS. NOTHING IS KNOWN about the
 *               grant — it may be perfect, and a refresh would fix nothing.
 *   malformed   GitHub's response could not be parsed as the documented shape.
 *
 * `installation` is separate from `auth` for the reason INT-4 had to add `disabled` to Google's
 * list at real-acceptance time: collapsing a provider-side configuration fact into "the credential
 * was refused" makes Hebun retry a thing no retry can fix, and tells a tenant their credential is
 * broken when it is not.
 */
export type GitHubFailureClass =
  | "auth"
  | "installation"
  | "permission"
  | "identity"
  | "transport"
  | "malformed";

export interface GitHubFailure {
  readonly ok: false;
  readonly failure: GitHubFailureClass;
  /**
   * A short, SAFE reason. Never a provider response body, never a token, never a JWT, never a
   * private key — a GitHub error payload can echo request parameters, and this string reaches logs
   * and screens.
   */
  readonly reason: string;
}

/**
 * The outcome of confirming an installation against GitHub.
 *
 * The `ok: true` arm is DECLARED AND UNREACHABLE in GITHUB-1 — no code path constructs it, because
 * no code path calls GitHub. Declaring it now means GITHUB-2 adds a producer rather than widening a
 * type, and that the consumer's exhaustive handling is written and reviewed before a real GitHub
 * response can ever arrive. `VerificationOutcome` was declared the same way, one phase early, and
 * that is why the Google verifier could be added without touching its consumers.
 */
export type GitHubInstallationOutcome =
  | { readonly ok: true; readonly identity: GitHubInstallationIdentity }
  | GitHubFailure;
