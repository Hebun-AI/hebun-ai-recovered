/*
 * Authority-shaped connection fixtures for surface tests.
 *
 * They are `IntegrationView` values — EXACTLY what `listConnections` returns — so a surface test
 * exercises the real seam shape without a database. A fixture that invented its own shape would
 * pass while the real listing rendered nothing.
 *
 * The default is deliberately modelled on the connection that actually exists in the local
 * deployment: a CONSUMER Gmail account, connected and healthy, with identity scopes only and no
 * hosted-domain observation anywhere. That is the case requirement 7 is about.
 */
import type { IntegrationView } from "../../src/features/integration-authority/contracts";

export const GOOGLE_IDENTITY_SCOPES: readonly string[] = Object.freeze([
  "https://www.googleapis.com/auth/userinfo.profile",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
]);

export function connectionFixture(overrides: Partial<IntegrationView> = {}): IntegrationView {
  return {
    integrationId: "11111111-1111-4111-8111-111111111111",
    name: "Google Workspace",
    providerKey: "google-workspace",
    connectionState: "connected",
    health: "healthy",
    scopes: GOOGLE_IDENTITY_SCOPES,
    externalAccountId: "114884615390589849256",
    externalAccountLabel: "someone@gmail.com",
    lastVerifiedAt: "2026-08-23T05:41:41.949Z",
    lastSuccessAt: "2026-08-23T05:41:41.949Z",
    lastErrorAt: null,
    failureReason: null,
    revokedAt: null,
    createdAt: "2026-08-23T05:41:40.000Z",
    ...overrides,
  };
}

/** A real, connected, consumer-Gmail Google connection. */
export function connectedFixture(overrides: Partial<IntegrationView> = {}): IntegrationView {
  return connectionFixture(overrides);
}
