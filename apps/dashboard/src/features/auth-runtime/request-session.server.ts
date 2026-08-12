/*
 * Request/cookie binding for the session service (server-only). This is the ONLY
 * module that touches next/headers, so the service core stays unit-testable.
 *
 * - getAuthEnvironment(): the env gate (disabled / invalid / configured).
 * - resolveRequestAuthentication(): cookie -> AuthenticationResult (fail closed).
 * - resolveTenantContext(): convenience for server components.
 * - setSessionCookie()/clearSessionCookie(): mutate the cookie (actions only).
 */

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getControlPlaneDb } from "@/db/client.server";
import {
  resolveAuthenticationEnvironment,
  type AuthenticationEnvironmentResolution,
  type ConfiguredAuthenticationEnvironment,
} from "@/features/auth/environment/auth-environment.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { AuthenticationResult } from "@/features/auth/types";
import {
  SESSION_ABSOLUTE_TTL_SECONDS,
  readSelectableWorkspaces,
  resolveSessionFromReference,
  selectTenantForSession,
} from "./session-service.server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./session-cookie";
import type { TenantCandidate } from "./identity-repository.server";
import type {
  WorkspaceSelectionRefusal,
  WorkspaceSelectionResult,
} from "@/features/tenant-selection/contracts";

/** The authentication environment gate for this process. */
export function getAuthEnvironment(): AuthenticationEnvironmentResolution {
  return resolveAuthenticationEnvironment(process.env);
}

async function readSessionReference(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value;
}

/**
 * Resolve the current request against a CONFIGURED auth environment. Reads the
 * session cookie and delegates to the durable session service. Never trusts any
 * client-supplied tenant identity — the tenant is derived from the session row.
 */
export async function resolveRequestAuthentication(
  env: ConfiguredAuthenticationEnvironment,
  input: { readonly requestId?: string; readonly correlationId?: string } = {},
): Promise<AuthenticationResult> {
  const reference = await readSessionReference();
  if (!reference) return { status: "unauthenticated", reason: "missing" };
  const requestId = input.requestId ?? randomUUID();
  return resolveSessionFromReference(getControlPlaneDb(), env, reference, {
    requestId,
    correlationId: input.correlationId,
  });
}

/**
 * Convenience for server components: returns the TenantContext when the request
 * is authorized under a configured environment, otherwise null. Returns null (not
 * an error) when auth is disabled — the caller decides how to present that.
 */
export async function resolveTenantContext(): Promise<TenantContext | null> {
  const env = getAuthEnvironment();
  if (env.status !== "configured") return null;
  const result = await resolveRequestAuthentication(env);
  return result.status === "authorized" ? result.tenantContext : null;
}

/** Set the session cookie (server actions / route handlers only). */
export async function setSessionCookie(
  reference: string,
  maxAgeSeconds: number = SESSION_ABSOLUTE_TTL_SECONDS,
): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, reference, sessionCookieOptions(maxAgeSeconds));
}

/** Clear the session cookie (server actions / route handlers only). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/*
 * ── TENANT SELECTION: the cookie half ───────────────────────────────────────────────────────────
 *
 * The two functions below are the ONLY place the workspace picker touches a cookie, for the same
 * reason `resolveRequestAuthentication` is: cookie handling belongs to one module, and the session
 * service stays unit-testable without `next/headers`.
 *
 * Neither accepts a user, a tenant or a session identifier from a caller. The human is whoever the
 * durable pre-tenant row says they are.
 */

/**
 * The workspaces the current pre-tenant receipt may choose between.
 *
 * Returns an empty list — never an error — when there is no usable receipt: a picker that cannot say
 * who it belongs to has nothing to show, and distinguishing "expired" from "you belong nowhere"
 * would leak session state to an unauthenticated page.
 */
export async function readSelectableWorkspacesForRequest(): Promise<readonly TenantCandidate[]> {
  const env = getAuthEnvironment();
  if (env.status !== "configured") return [];
  const reference = await readSessionReference();
  if (!reference) return [];
  try {
    return await readSelectableWorkspaces(getControlPlaneDb(), env, reference);
  } catch {
    return [];
  }
}

/**
 * Choose ONE workspace and become authorized in it.
 *
 * The client supplies a membership id and nothing else. On success a FRESH session cookie replaces
 * the pre-tenant one — the old reference is revoked server-side, so a copy of it is already dead.
 */
export async function selectWorkspaceForRequest(
  membershipId: string,
): Promise<WorkspaceSelectionResult> {
  const env = getAuthEnvironment();
  if (env.status !== "configured") return refusedSelection("unavailable");
  const reference = await readSessionReference();
  if (!reference) return refusedSelection("no-selection-context");

  let outcome;
  try {
    outcome = await selectTenantForSession(getControlPlaneDb(), env, reference, {
      membershipId: typeof membershipId === "string" ? membershipId : "",
      requestId: randomUUID(),
    });
  } catch {
    return refusedSelection("unavailable");
  }

  if (outcome.status !== "selected") return refusedSelection(outcome.reason);
  if (outcome.result.status !== "authorized") return refusedSelection("membership-unavailable");

  await setSessionCookie(outcome.reference, outcome.maxAgeSeconds);
  return { status: "selected", tenantId: outcome.result.tenantContext.tenantId };
}

function refusedSelection(reason: WorkspaceSelectionRefusal): WorkspaceSelectionResult {
  return { status: "refused", reason };
}
