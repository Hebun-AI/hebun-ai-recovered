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
export {
  createRequestAuthenticationContainer,
  type RequestAuthenticationContainer,
} from "./services/request-authentication-container";
