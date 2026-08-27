export {
  AUTHENTICATION_ENV_KEYS,
  resolveAuthenticationEnvironment,
  type AuthenticationDigestKey,
  type AuthenticationEnvironmentResolution,
  type AuthenticationProviderMode,
  type ConfiguredAuthenticationEnvironment,
} from "./environment/auth-environment.server";
export type {
  AuthenticationProvider,
  AuthenticationProviderRequest,
  ProviderCookieAccess,
  ProviderCookieOptions,
  SupabaseAuthenticationProvider,
  SupabaseServerClientFactory,
} from "./provider";
export {
  createAuthorizedAuthenticationResult,
  type AuthorizedAuthenticationResultInput,
} from "./services/authorized-authentication-result.server";
/*
 * The human authority projection's mint, exported beside the other branded-value factory for the
 * same reason: a nominal type is only reachable through the function that applies its marker.
 * A firewall test pins its `src/` callers to the single session-runtime producer.
 */
export { asHumanTenantContext } from "./tenant/tenant-context";
export {
  createRequestAuthenticationContainer,
  type RequestAuthenticationContainer,
} from "./services/request-authentication-container";
