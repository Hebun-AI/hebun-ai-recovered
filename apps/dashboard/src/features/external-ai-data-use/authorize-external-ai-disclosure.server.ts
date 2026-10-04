/*
 * external-ai-data-use/authorize-external-ai-disclosure.server.ts — MAY THIS REQUEST CROSS TO
 * ANTHROPIC? (EXTERNAL-AI-DATA-USE-B2)
 *
 * The runtime reading of the three authorities, and nothing more. It reads the processor
 * attestation in force and this tenant's effective authorization through the released readers,
 * takes the R2E Claude control as the CALLER read it (this authority reaches no R2E module), and
 * hands all of it to the released pure composer with the RECORDED platform policy. It decides nothing itself, writes nothing and caches
 * nothing; every read failure is `unavailable`, and anything but `authorized` is a refusal.
 *
 * ── WHO DECLARES WHAT ───────────────────────────────────────────────────────
 *
 * The caller declares the tenant (from its authenticated TenantContext), the purpose and the data
 * classes it is about to send, each class named by the AUTHORITY THAT OWNS the data — never by a
 * guess at its sensitivity. A declaration is not authority: the composer requires every declared
 * class to be platform-ALLOWED, inside the attestation's bounds and authorized by this tenant.
 *
 * ── THE ACCOUNT IS CONFIGURATION, NOT A VERIFIED FACT ───────────────────────
 *
 * `CONFIGURED_ANTHROPIC_ACCOUNT_REF` is the account the reviewed B1B record found the deployment's
 * key in. That the production credential belongs to it is ATTESTED, not verified, and this constant
 * does not upgrade it. A different account would find no attestation and no tenant lineage, and
 * refuse.
 *
 * ── TIME OF CHECK ───────────────────────────────────────────────────────────
 *
 * Read once per request, immediately before dispatch. Every authority here is append-only — a
 * withdrawal or a new attestation revision is a new row — so a change can land only in the
 * milliseconds between this read and the send of the ONE request it decided; the next request reads
 * it. No lock is taken.
 *
 * Server-only.
 */
import { composeExternalAiDisclosure, type DisclosureDecision } from "./compose-external-ai-disclosure";
import { isDataClass, isPurpose, type DataClass, type Purpose } from "./contracts";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "./platform-disclosure-policy";
import { readLatestProcessorAttestation, type ProcessorAttestationReadDeps } from "./read-processor-attestations.server";
import { readEffectiveTenantExternalAiDataUse } from "./read-tenant-external-ai-data-use.server";

export const ANTHROPIC_MESSAGES_SCOPE = "anthropic/messages" as const;
export const CONFIGURED_ANTHROPIC_ACCOUNT_REF = "14ea4a95-7d92-4844-8aca-5de14968a87d";

export interface ExternalAiDisclosureDeclaration {
  /** From the caller's authenticated TenantContext. Never from a client, a prompt or a model. */
  readonly tenantId: string;
  readonly purpose: Purpose;
  /** Every class the request carries. All are REQUIRED: one unauthorized class refuses the request. */
  readonly dataClasses: readonly DataClass[];
}

export type AuthorizeExternalAiDisclosure = (
  declaration: ExternalAiDisclosureDeclaration | null,
  /** The R2E Claude control as its own reader answered; `null` when it could not be read. */
  operatorEnabled: boolean | null,
) => Promise<DisclosureDecision>;

export async function authorizeExternalAiDisclosure(
  declaration: ExternalAiDisclosureDeclaration | null,
  operatorEnabled: boolean | null,
  deps: ProcessorAttestationReadDeps = {},
): Promise<DisclosureDecision> {
  if (typeof window !== "undefined") throw new Error("External AI disclosure authorization is server-only.");
  const valid =
    !!declaration?.tenantId &&
    isPurpose(declaration.purpose) &&
    declaration.dataClasses.length > 0 &&
    declaration.dataClasses.every(isDataClass);

  const read = async <T>(fn: () => Promise<T>): Promise<T | { status: "unavailable" }> => {
    try {
      return await fn();
    } catch {
      return { status: "unavailable" };
    }
  };
  const [attestation, tenant] = valid
    ? await Promise.all([
        read(() => readLatestProcessorAttestation(ANTHROPIC_MESSAGES_SCOPE, CONFIGURED_ANTHROPIC_ACCOUNT_REF, deps)),
        read(() =>
          readEffectiveTenantExternalAiDataUse(declaration!.tenantId, ANTHROPIC_MESSAGES_SCOPE, CONFIGURED_ANTHROPIC_ACCOUNT_REF, deps),
        ),
      ])
    : [{ status: "unavailable" as const }, { status: "unavailable" as const }];

  return composeExternalAiDisclosure({
    request: {
      serviceScope: ANTHROPIC_MESSAGES_SCOPE,
      purpose: valid ? declaration!.purpose : "assistance",
      requiredDataClasses: valid ? declaration!.dataClasses : [],
    },
    policy: RECORDED_PLATFORM_DISCLOSURE_POLICY,
    accountRef: CONFIGURED_ANTHROPIC_ACCOUNT_REF,
    attestation: attestation as Parameters<typeof composeExternalAiDisclosure>[0]["attestation"],
    tenant: tenant as Parameters<typeof composeExternalAiDisclosure>[0]["tenant"],
    operatorEnabled,
    /* Reached only from the generator after it found a configured transport. */
    providerAvailable: true,
  });
}
