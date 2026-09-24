/*
 * PUBLISH-0 — scope model and capability derivation. Pure; no database, no network.
 *
 *   connected alone ≠ publish-capable · missing scope fails closed · missing identity fails closed
 *   unhealthy fails closed · ambiguity fails closed · available carries the runtime publishing id
 */
import assert from "node:assert/strict";
import {
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
  INSTAGRAM_CONTENT_PUBLISH_SCOPE,
  INSTAGRAM_MEDIA_PUBLISH_CAPABILITY,
  INSTAGRAM_PROVIDER_KEY,
  INSTAGRAM_REQUESTED_SCOPES,
  INSTAGRAM_REQUIRED_SCOPES,
  coversRequiredScopes,
  recordableGrantedScopes,
} from "../../src/features/provider-instagram/contracts";
import {
  derivePublishCapability,
  type PublishCapabilityFacts,
  type PublishConnectionFacts,
} from "../../src/features/provider-instagram/publish-capability";
import { findProviderDefinition } from "../../src/features/provider-catalog/catalog";
import { readFileSync } from "node:fs";

const BASIC = INSTAGRAM_BUSINESS_BASIC_SCOPE;
const PUBLISH = INSTAGRAM_CONTENT_PUBLISH_SCOPE;
const APP_ID = "28295264780115792";
const IG_ID = "17841408635351823";

/* ── Consent asks for exactly one more scope, and does not require it. ── */
assert.deepEqual([...INSTAGRAM_REQUESTED_SCOPES], [BASIC, PUBLISH], "requested = basic + publish, nothing else");
assert.deepEqual([...INSTAGRAM_REQUIRED_SCOPES], [BASIC], "publish is requested, never required");
assert.equal(coversRequiredScopes([BASIC]), true, "declining publish still yields a read connection");
for (const banned of ["comments", "messages", "insights", "manage"]) {
  assert.equal(
    INSTAGRAM_REQUESTED_SCOPES.some((s) => s.includes(banned)),
    false,
    `no ${banned} scope is requested`,
  );
}

/* ── Recorded scopes: basic is proven by the read; publish only when Meta STATED it. ── */
assert.deepEqual([...recordableGrantedScopes(null)], [BASIC], "unstated grant records basic only");
assert.deepEqual([...recordableGrantedScopes([BASIC])], [BASIC]);
assert.deepEqual([...recordableGrantedScopes([BASIC, PUBLISH])], [BASIC, PUBLISH]);
assert.deepEqual(
  [...recordableGrantedScopes([BASIC, PUBLISH, "instagram_business_manage_comments"])],
  [BASIC, PUBLISH],
  "a scope Hebun never asked for is never recorded",
);

/* ── The catalog declares publishing and requires the publish scope on BOTH halves. ── */
const definition = findProviderDefinition(INSTAGRAM_PROVIDER_KEY);
const declared = definition?.capabilityScopes[INSTAGRAM_MEDIA_PUBLISH_CAPABILITY];
assert.ok(declared, "the publish capability is declared");
assert.deepEqual([...declared.read], [BASIC], "read half: identity + container status under basic");
assert.deepEqual([...declared.write], [PUBLISH], "write half: the publish itself — so writeCapable needs the publish grant");
assert.deepEqual([...definition!.minimumScopes], [BASIC], "minimum scopes unchanged");

/* ── Derivation. ── */
const healthy: PublishConnectionFacts = {
  integrationId: "31fcbd7c-8dd7-48eb-adf6-6548981a10ba",
  connectionState: "connected",
  health: "healthy",
  externalAccountId: APP_ID,
  scopes: [BASIC, PUBLISH],
};
const facts = (over: Partial<PublishConnectionFacts> = {}, extra: Partial<PublishCapabilityFacts> = {}) =>
  ({ declared: true, connections: [{ ...healthy, ...over }], ...extra }) as PublishCapabilityFacts;
const identity = {
  ok: true as const,
  value: { appScopedAccountId: APP_ID, publishingAccountId: IG_ID },
};
const reason = (r: ReturnType<typeof derivePublishCapability>) => (r.status === "unavailable" ? r.reason : r.status);

assert.equal(
  reason(derivePublishCapability(facts({ scopes: [BASIC] }), identity)),
  "publish-scope-not-granted",
  "CONNECTED + HEALTHY + BASIC is not publish-capable — today's TRH connection",
);
assert.equal(reason(derivePublishCapability(facts({ scopes: [PUBLISH] }), identity)), "publish-scope-not-granted");
assert.equal(reason(derivePublishCapability(facts({ health: "degraded" }), identity)), "unhealthy");
assert.equal(reason(derivePublishCapability(facts({ health: "unknown" }), identity)), "unhealthy");
assert.equal(reason(derivePublishCapability(facts({ connectionState: "unverified" }), identity)), "not-connected");
assert.equal(reason(derivePublishCapability(facts({ externalAccountId: null }), identity)), "account-unbound");
assert.equal(reason(derivePublishCapability({ declared: true, connections: [] }, identity)), "no-connection");
assert.equal(reason(derivePublishCapability(facts({}, { declared: false }), identity)), "capability-not-declared");
assert.equal(
  reason(
    derivePublishCapability(
      { declared: true, connections: [healthy, { ...healthy, integrationId: "x", externalAccountId: "1" }] },
      identity,
    ),
  ),
  "ambiguous-connection",
);
assert.equal(
  reason(
    derivePublishCapability(
      { declared: true, connections: [healthy, { ...healthy, integrationId: "x", connectionState: "revoked" }] },
      identity,
    ),
  ).valueOf(),
  "available",
  "a revoked sibling does not create ambiguity",
);
assert.equal(reason(derivePublishCapability(facts(), null)), "publishing-identity-unavailable");
assert.equal(
  reason(derivePublishCapability(facts(), { ok: false, failure: "auth", reason: "credential-missing" })),
  "publishing-identity-unavailable",
);
assert.equal(
  reason(
    derivePublishCapability(facts(), {
      ok: true,
      value: { appScopedAccountId: "999", publishingAccountId: IG_ID },
    }),
  ),
  "publishing-identity-unavailable",
  "an identity for another account is refused",
);

const available = derivePublishCapability(facts(), identity);
assert.equal(available.status, "available");
assert.equal(available.status === "available" && available.publishingAccountId, IG_ID, "runtime user_id, not the bound id");
assert.equal(
  Object.keys(available).some((k) => /authoriz|permit|executed|success/i.test(k)),
  false,
  "available carries no authorization, execution or success claim",
);

/* ── The verifier records Meta's statement through the one helper; the callback hands it over. ── */
const verifier = readFileSync("src/features/provider-instagram/verify-instagram-connection.server.ts", "utf8");
assert.ok(verifier.includes("grantedScopes: recordableGrantedScopes(statedScopes)"), "verifier records via helper");
assert.equal(/grantedScopes:\s*Object\.freeze\(\[INSTAGRAM_BUSINESS_BASIC_SCOPE\]\)/.test(verifier), false, "no hardcoded grant");
const callback = readFileSync("src/app/api/integrations/instagram/callback/route.ts", "utf8");
assert.ok(/verifyInstagramConnection\([\s\S]*?statedScopes,\s*\)/.test(callback), "callback passes Meta's statement");

console.log("PASS publish-0 capability and scope");
