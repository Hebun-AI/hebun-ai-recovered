export const AUTHENTICATION_ENV_KEYS = {
  enabled: "HEBUN_AUTH_ENABLED",
  provider: "HEBUN_AUTH_PROVIDER",
  controlPlaneDatabaseUrl: "DATABASE_URL",
  supabaseUrl: "SUPABASE_URL",
  supabasePublishableKey: "SUPABASE_ANON_KEY",
  sessionDigestCurrentVersion: "HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION",
  sessionDigestCurrentSecret: "HEBUN_AUTH_SESSION_DIGEST_SECRET",
  sessionDigestPreviousVersion: "HEBUN_AUTH_SESSION_DIGEST_PREVIOUS_VERSION",
  sessionDigestPreviousSecret: "HEBUN_AUTH_SESSION_DIGEST_PREVIOUS_SECRET",
} as const;

/**
 * Identity provider mode.
 * - `supabase` (default): Supabase Auth would be the sign-in provider; SUPABASE_URL
 *   + SUPABASE_ANON_KEY are required in addition to the control plane + digest.
 *   NOTE: no Supabase sign-in flow is implemented — the adapter is a marker
 *   interface with no SDK. Configuring this mode does not produce a working login.
 * - `local`: sign-in verifies a real password credential (D1) against
 *   `auth_credentials` with scrypt, then resolves the canonical local identity in
 *   the control plane. No Supabase project is required.
 *
 * D1 CORRECTION. Before D1 this comment claimed local mode was "a real, enforced
 * auth boundary — not a bypass". That was true of SESSION VERIFICATION and
 * misleading about SIGN-IN: an email alone minted a session, with no credential
 * checked. Both halves are now real — a password is verified before any session
 * exists — but the two claims are distinct and are stated separately on purpose.
 *
 * What `local` mode does NOT provide: MFA (every session is aal1,
 * mfaVerified=false), password recovery, single sign-on, and any protection
 * against distributed brute force beyond per-credential durable lockout.
 */
export type AuthenticationProviderMode = "supabase" | "local";

export interface AuthenticationDigestKey {
  readonly version: number;
  readonly secret: string;
}

export interface ConfiguredAuthenticationEnvironment {
  readonly status: "configured";
  readonly enabled: true;
  readonly provider: AuthenticationProviderMode;
  readonly controlPlaneDatabaseUrl: string;
  /** Present only in `supabase` provider mode. */
  readonly supabaseUrl?: string;
  /** Present only in `supabase` provider mode. */
  readonly supabasePublishableKey?: string;
  readonly sessionDigestCurrentKey: AuthenticationDigestKey;
  readonly sessionDigestPreviousKey?: AuthenticationDigestKey;
}

export type AuthenticationEnvironmentResolution =
  | { readonly status: "disabled"; readonly enabled: false }
  | ConfiguredAuthenticationEnvironment
  | {
      readonly status: "invalid";
      readonly enabled: true;
      readonly missingKeys: readonly string[];
      readonly invalidKeys: readonly string[];
    };

function parseKeyVersion(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value.trim())) return undefined;
  const version = Number(value.trim());
  return Number.isSafeInteger(version) && version > 0 ? version : undefined;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Authentication environment is server-only.");
  }
}

function resolveProviderMode(
  value: string | undefined,
): AuthenticationProviderMode | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized === "supabase") return "supabase";
  if (normalized === "local") return "local";
  return undefined;
}

export function resolveAuthenticationEnvironment(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AuthenticationEnvironmentResolution {
  assertServerRuntime();

  if (env[AUTHENTICATION_ENV_KEYS.enabled] !== "true") {
    return Object.freeze({ status: "disabled", enabled: false });
  }

  const provider = resolveProviderMode(env[AUTHENTICATION_ENV_KEYS.provider]);
  const invalidKeys: string[] = [];
  if (provider === undefined) {
    // An explicit but unrecognized provider is a configuration error.
    invalidKeys.push(AUTHENTICATION_ENV_KEYS.provider);
  }

  // Required key order is preserved for `supabase` to keep the historical
  // missing-key contract intact; `local` drops the Supabase project keys.
  const required =
    provider === "local"
      ? ([
          AUTHENTICATION_ENV_KEYS.controlPlaneDatabaseUrl,
          AUTHENTICATION_ENV_KEYS.sessionDigestCurrentVersion,
          AUTHENTICATION_ENV_KEYS.sessionDigestCurrentSecret,
        ] as const)
      : ([
          AUTHENTICATION_ENV_KEYS.controlPlaneDatabaseUrl,
          AUTHENTICATION_ENV_KEYS.supabaseUrl,
          AUTHENTICATION_ENV_KEYS.supabasePublishableKey,
          AUTHENTICATION_ENV_KEYS.sessionDigestCurrentVersion,
          AUTHENTICATION_ENV_KEYS.sessionDigestCurrentSecret,
        ] as const);

  const missingKeys = required.filter((key) => !env[key]?.trim());
  const previousVersionValue =
    env[AUTHENTICATION_ENV_KEYS.sessionDigestPreviousVersion]?.trim();
  const previousSecret =
    env[AUTHENTICATION_ENV_KEYS.sessionDigestPreviousSecret]?.trim();
  const currentVersion = parseKeyVersion(
    env[AUTHENTICATION_ENV_KEYS.sessionDigestCurrentVersion],
  );
  const previousVersion = parseKeyVersion(previousVersionValue);

  if (
    env[AUTHENTICATION_ENV_KEYS.sessionDigestCurrentVersion]?.trim() &&
    currentVersion === undefined
  ) {
    invalidKeys.push(AUTHENTICATION_ENV_KEYS.sessionDigestCurrentVersion);
  }
  if (Boolean(previousVersionValue) !== Boolean(previousSecret)) {
    invalidKeys.push(
      previousVersionValue
        ? AUTHENTICATION_ENV_KEYS.sessionDigestPreviousSecret
        : AUTHENTICATION_ENV_KEYS.sessionDigestPreviousVersion,
    );
  } else if (previousVersionValue && previousVersion === undefined) {
    invalidKeys.push(AUTHENTICATION_ENV_KEYS.sessionDigestPreviousVersion);
  } else if (previousVersion !== undefined && previousVersion === currentVersion) {
    invalidKeys.push(AUTHENTICATION_ENV_KEYS.sessionDigestPreviousVersion);
  }

  if (missingKeys.length > 0 || invalidKeys.length > 0) {
    return Object.freeze({
      status: "invalid",
      enabled: true,
      missingKeys: Object.freeze([...missingKeys]),
      invalidKeys: Object.freeze(invalidKeys),
    });
  }

  const resolvedProvider = provider ?? "supabase";
  const base = {
    status: "configured" as const,
    enabled: true as const,
    provider: resolvedProvider,
    controlPlaneDatabaseUrl:
      env[AUTHENTICATION_ENV_KEYS.controlPlaneDatabaseUrl]!.trim(),
    sessionDigestCurrentKey: Object.freeze({
      version: currentVersion!,
      secret: env[AUTHENTICATION_ENV_KEYS.sessionDigestCurrentSecret]!.trim(),
    }),
    sessionDigestPreviousKey:
      previousVersion !== undefined && previousSecret
        ? Object.freeze({ version: previousVersion, secret: previousSecret })
        : undefined,
  };

  if (resolvedProvider === "supabase") {
    return Object.freeze({
      ...base,
      supabaseUrl: env[AUTHENTICATION_ENV_KEYS.supabaseUrl]!.trim(),
      supabasePublishableKey:
        env[AUTHENTICATION_ENV_KEYS.supabasePublishableKey]!.trim(),
    });
  }

  return Object.freeze(base);
}
