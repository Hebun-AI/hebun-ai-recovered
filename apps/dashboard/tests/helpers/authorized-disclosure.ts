/*
 * EXTERNAL-AI-DATA-USE-B2 — a test stand-in for the three-authority gate, for suites that drive the
 * REAL live Claude transport (with an injected fetch) and are about something else. It answers
 * `authorized` without reading anything. The gate itself is proven in tests/external-ai-data-use-b2.
 */
import type { AuthorizeExternalAiDisclosure } from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import type { RecordExternalAiDisclosureDecision } from "../../src/features/governance-audit/external-ai-disclosure-audit.server";

export const authorizedDisclosure: AuthorizeExternalAiDisclosure = async () => ({
  disposition: "authorized",
  authorizationId: "00000000-0000-4000-8000-0000000000b2",
  attestationId: "00000000-0000-4000-8000-0000000000b1",
  authorizationRevision: 1,
  attestationRevision: 1,
  authorizedDataClasses: ["conversation"],
  components: { platform: "allowed", attestation: "active", tenant: "active", change: "equivalent", operator: "enabled", provider: "available" },
});

/** APF-5 — the evidence stand-in that pairs with it: records nothing, reports durable. */
export const recordedDisclosure: RecordExternalAiDisclosureDecision = async () => true;
