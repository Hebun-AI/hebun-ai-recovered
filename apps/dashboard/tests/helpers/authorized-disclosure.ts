/*
 * EXTERNAL-AI-DATA-USE-B2 — a test stand-in for the three-authority gate, for suites that drive the
 * REAL live Claude transport (with an injected fetch) and are about something else. It answers
 * `authorized` without reading anything. The gate itself is proven in tests/external-ai-data-use-b2.
 */
import type { AuthorizeExternalAiDisclosure } from "../../src/features/external-ai-data-use/authorize-external-ai-disclosure.server";
import type { RecordExternalAiDisclosureDecision } from "../../src/features/governance-audit/external-ai-disclosure-audit.server";
import type { AdmitAiDispatch } from "../../src/features/ai-dispatch-cap/ai-dispatch-safety-cap.server";

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

/*
 * AP-3 — the dispatch-cap stand-in for suites with no database. It never refuses on the cap (the cap is
 * proven in tests/ap3-dispatch-safety-cap) but keeps the released ORDER: the process budget is taken
 * before the evidence, and a budget refusal is still a refusal.
 */
export const admittedDispatch: AdmitAiDispatch = async (input) => {
  if (input.prepay && !input.prepay()) return { status: "refused", reason: "process-budget-exhausted" };
  try {
    return { status: "admitted", value: await input.commit(null as never) };
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
};
