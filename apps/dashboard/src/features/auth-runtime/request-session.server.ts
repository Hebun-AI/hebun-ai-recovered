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
  resolveSessionFromReference,
} from "./session-service.server";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "./session-cookie";

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
