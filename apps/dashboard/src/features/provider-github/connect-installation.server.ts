/*
 * provider-github/connect-installation.server.ts — WHERE A VERIFIED INSTALLATION BECOMES A
 * CONNECTION.
 *
 * ── IT ADDS NO AUTHORITY ─────────────────────────────────────────────────────
 *
 * It consults the verifier (which owns provider confirmation) and the integration authority (which
 * owns the lifecycle), and it owns NEITHER. It contains no SQL, no state literal it writes
 * directly, no endpoint, no key and no JWT. Every transition below goes through a released writer,
 * inside one transaction, so the lifecycle keeps exactly one owner.
 *
 * ── THE ORDER IS THE SECURITY PROPERTY ───────────────────────────────────────
 *
 *   1. GitHub is asked what the installation id names.          ← the only source of truth
 *   2. The answer must be an ORGANIZATION.                      ← released Director decision
 *   3. The installation must not be SUSPENDED.                  ← a suspended install grants nothing
 *   4. The selection must be SELECTED repositories.             ← released Director decision
 *   5. The GRANTED permissions must cover what is required.     ← granted, never requested
 *   6. Only then does the connection reach `connected`.
 *
 * Every one of those is a refusal that leaves the connection NOT connected. None of them is a
 * warning, and none is resolved in the permissive direction.
 *
 * ── WHY A FAILED CHECK IS NOT A FAILED VERIFICATION ──────────────────────────
 *
 * `recordVerificationFailureWithin` exists for the case where the PROVIDER refused or could not be
 * reached. A wrong account type is neither: GitHub answered perfectly and the answer was not
 * something Hebun connects to. Writing a verification failure there would say Hebun's credential
 * or the tenant's grant is in trouble, when the truth is that the tenant installed the App
 * somewhere this product does not support. So policy refusals leave the row exactly where it is
 * and report a reason; only `auth` and `transport` classes touch health.
 *
 * Server-only.
 */
import type { ControlPlaneDatabase } from "@/db/client.server";
import { getControlPlaneDb } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  recordUnverifiedProviderGrantWithin,
  recordVerificationFailureWithin,
  recordVerifiedConnectionWithin,
} from "@/features/integration-authority/integration-repository.server";
import {
  GITHUB_ACCEPTED_REPOSITORY_SELECTION,
  GITHUB_REQUIRED_GRANTED_PERMISSIONS,
  coversRequiredPermissions,
  type GitHubInstallationIdentity,
} from "./contracts";
import { verifyGitHubInstallation, type VerifyInstallationDeps } from "./verify-installation.server";

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("GitHub connection establishment is server-only.");
  }
}

/**
 * Why an installation did not become a connection.
 *
 * A CLOSED SET, and every member is a distinct operator or tenant problem. They are deliberately
 * not collapsed into "not connected": a suspended installation, an under-permissioned one and a
 * GitHub outage need three different actions, and a single reason would send every one of them to
 * the same unhelpful screen.
 */
export type GitHubConnectRefusal =
  /* Hebun's own configuration is absent or malformed. Nothing was asked of GitHub. */
  | "not-configured"
  /* GitHub refused Hebun's App assertion. An operator problem, never the tenant's. */
  | "app-credential-refused"
  /* No such installation, or it has been uninstalled. */
  | "installation-not-found"
  /* GitHub could not be reached, or had a bad minute. NOTHING is known. */
  | "provider-unreachable"
  /* GitHub answered with something this provider cannot bind to. */
  | "installation-not-understood"
  /* A personal installation. Refused by released decision, never silently supported. */
  | "not-an-organization"
  /* Installed, but suspended. It grants nothing until a human un-suspends it. */
  | "installation-suspended"
  /* Installed across every repository. The released decision is selected repositories only. */
  | "repository-selection-too-broad"
  /* Real, live, and it did not grant what the connection requires. */
  | "insufficient-granted-permissions"
  /* The connection row could not be moved — see the authority's own refusal vocabulary. */
  | "connection-refused";

export type GitHubConnectOutcome =
  | {
      readonly status: "connected";
      readonly integrationId: string;
      readonly identity: GitHubInstallationIdentity;
    }
  | {
      readonly status: "refused";
      readonly reason: GitHubConnectRefusal;
      /**
       * The provider-confirmed identity, WHEN ONE WAS ESTABLISHED.
       *
       * Present for policy refusals — suspended, too broad, under-permissioned — because a tenant
       * who is told "not enough permissions" needs to see WHICH organization and WHAT was actually
       * granted in order to fix it. Absent when GitHub never answered.
       */
      readonly identity?: GitHubInstallationIdentity;
    };

export interface ConnectInstallationDeps extends VerifyInstallationDeps {
  readonly getDb?: () => ControlPlaneDatabase;
  readonly now?: Date;
}

/**
 * Establish a GitHub connection from an UNTRUSTED installation id.
 *
 * `installationId` arrives from a redirect and is treated as a claim throughout — it is used to
 * ASK GitHub a question, and every fact written afterwards comes from GitHub's answer rather than
 * from the parameter. `integrationId` is the tenant's own row, already bound by signed state.
 */
export async function connectGitHubInstallation(
  tenant: TenantContext,
  integrationId: string,
  installationId: number,
  deps: ConnectInstallationDeps = {},
): Promise<GitHubConnectOutcome> {
  assertServerOnly();

  const now = deps.now ?? new Date();
  /*
   * ── THE DATABASE IS RESOLVED LAZILY, AND THAT IS A PROPERTY ──────────────
   *
   * A refused installation must not touch persistence at all — not to open a transaction, not to
   * construct a handle. Resolving it eagerly here made that true only by accident of ordering; a
   * test whose `getDb` throws proved otherwise on the first run. Now the handle is created at the
   * two points that genuinely need one, so "a refusal writes nothing" holds structurally.
   */
  const db = () => (deps.getDb ?? getControlPlaneDb)();

  /* ── 1. ASK GITHUB. Nothing below trusts the parameter. ───────────────────── */
  const verified = await verifyGitHubInstallation(installationId, deps);

  if (!verified.ok) {
    /*
     * Only the classes that say something about the GRANT or the PROVIDER touch the row. A
     * configuration problem and an identity problem are Hebun's and GitHub's respectively, and
     * neither is evidence about this tenant's connection health.
     */
    if (verified.failure === "transport") {
      await db().transaction(async (tx) => {
        await recordVerificationFailureWithin(
          tx,
          tenant,
          integrationId,
          { kind: "unreachable", reason: verified.reason },
          now,
        );
      });
      return { status: "refused", reason: "provider-unreachable" };
    }
    if (verified.failure === "installation") {
      return { status: "refused", reason: "installation-not-found" };
    }
    if (verified.failure === "auth") {
      return {
        status: "refused",
        reason: verified.reason === "github-app-not-configured" ? "not-configured" : "app-credential-refused",
      };
    }
    if (verified.failure === "identity") {
      return {
        status: "refused",
        reason:
          verified.reason === "installation-is-not-an-organization"
            ? "not-an-organization"
            : "installation-not-understood",
      };
    }
    return { status: "refused", reason: "installation-not-understood" };
  }

  const identity = verified.identity;

  /* ── 2. POLICY, ON THE PROVIDER'S ANSWER. Each refusal leaves the row untouched. ── */
  if (identity.suspended) {
    return { status: "refused", reason: "installation-suspended", identity };
  }
  if (!GITHUB_ACCEPTED_REPOSITORY_SELECTION.includes(identity.repositorySelection)) {
    return { status: "refused", reason: "repository-selection-too-broad", identity };
  }
  /*
   * ── GRANTED, NEVER REQUESTED ──────────────────────────────────────────────
   *
   * `GITHUB_REQUIRED_GRANTED_PERMISSIONS` is what must come BACK; `GITHUB_REQUESTED_PERMISSIONS`
   * is what the App asks for. They are separate constants for exactly this comparison, and
   * checking against the requested set would pass while proving nothing.
   *
   * Extra permissions GitHub happens to have granted are NOT refused here and NOT treated as
   * capability. They are persisted verbatim below, so a tenant can see the access their
   * organization actually gave — the availability seam decides separately what any of it can
   * answer, from the catalog's capability scopes.
   */
  if (!coversRequiredPermissions(identity.grantedPermissions)) {
    return { status: "refused", reason: "insufficient-granted-permissions", identity };
  }

  /* ── 3. LIFECYCLE, THROUGH THE AUTHORITY, IN ONE TRANSACTION. ─────────────── */
  return db().transaction(async (tx): Promise<GitHubConnectOutcome> => {
    /*
     * `draft → unverified` first, because `draft → connected` is not an arc in the released
     * transition table and this module may not add one. The hop records that a provider-side grant
     * now exists and nothing has confirmed it — which was true one line ago and is about to stop
     * being true, inside the same transaction, so no reader ever observes the intermediate state.
     */
    const claimed = await recordUnverifiedProviderGrantWithin(tx, tenant, integrationId, now);
    if (claimed.status !== "attached") {
      return { status: "refused", reason: "connection-refused", identity };
    }

    const connected = await recordVerifiedConnectionWithin(
      tx,
      tenant,
      integrationId,
      {
        /*
         * THE INSTALLATION ID IS THE EXTERNAL ACCOUNT ID — and it is GitHub's own value from the
         * response body, not the query parameter that started this. It is an identifier, not a
         * secret: it names which installation, and holding it grants nothing without the App
         * private key that lives only in the environment.
         */
        externalAccountId: String(identity.installationId),
        /*
         * The organization login is a LABEL. `accountId` is the immutable identity, and an
         * organization can be renamed — so the login is displayed and the numeric id is what a
         * future phase would compare against. The label is what a human recognises in a list.
         */
        externalAccountLabel: identity.accountLogin,
        /* GitHub's own statement of what it granted, normalised. Never what Hebun asked for. */
        grantedScopes: identity.grantedPermissions,
      },
      now,
    );

    if (connected.status !== "verified") {
      return { status: "refused", reason: "connection-refused", identity };
    }
    return { status: "connected", integrationId, identity };
  });
}

/** The permissions a connection must hold. Re-exported so a surface can explain a refusal. */
export const GITHUB_CONNECTION_REQUIRED_PERMISSIONS = GITHUB_REQUIRED_GRANTED_PERMISSIONS;
