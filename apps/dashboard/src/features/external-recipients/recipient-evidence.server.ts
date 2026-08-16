/*
 * external-recipients/recipient-evidence.server.ts — the server seam that makes recorded
 * recipients retrievable (R3R).
 *
 * It produces one `SourceResolution` — the same shape Operations, Platform, Knowledge and work
 * artifacts produce — so a recipient enters the evidence set through the SAME deterministic path
 * as everything else. That matters more here than anywhere: the response validator rejects any
 * evidence reference the assembler did not build, so a model can never invent
 * `external-recipient/<uuid>` and have it accepted as a citation. Evidence identity comes only
 * from a real tenant-scoped read, which is what stops a model naming a person who was never
 * recorded.
 *
 * WHY THE PURE RESOLVER CANNOT DO THIS. `heby-runtime/source-resolver.ts` is pure — it holds no
 * tenant and can open no connection — so it honestly reports `external-recipients` as unavailable.
 * This module supplies what it cannot. Exactly the K1/R3W arrangement, deliberately not a new
 * pattern.
 *
 * ONLY ACTIVE RECIPIENTS ARE OFFERED. A retired recipient stays readable forever through
 * `resolveRecipientReference`, but it is not surfaced as a proposable referent: an action prepared
 * today should be prepared against an address the tenant still stands behind. A permit already
 * bound to a retired recipient is R3B's problem to refuse at execution time, not this module's to
 * hide.
 *
 * AUTHORITATIVE IS ALWAYS FALSE, and here that is a stronger statement than usual. The tenant
 * typed this address; Hebun did not verify it, does not know whether anyone owns it, and makes no
 * claim it can be delivered to. There is no verification system in this repository to appeal to.
 *
 * Server-only. Reads only.
 */
import { type ControlPlaneDatabase } from "@/db/client.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type { SourceResolution } from "@/features/heby-runtime";
import { listActiveRecipients } from "./read-external-recipients.server";

const RECIPIENT_PROVENANCE =
  "Recorded recipients — addresses your organization entered. Durable and tenant-scoped, never verified and never authoritative (authoritative: false).";

export interface RecipientEvidenceDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

function unavailable(reason: string): SourceResolution {
  return {
    sourceClass: "external-recipients",
    state: "unavailable",
    provenance: RECIPIENT_PROVENANCE,
    authoritative: false,
    items: [],
    unavailableReason: reason,
  };
}

/**
 * Resolve this tenant's active recipients into one source resolution.
 *
 * An empty organization resolves to `unavailable`, not to an empty `resolved` — the same
 * distinction Knowledge and work artifacts draw, and for the same reason: an empty "resolved"
 * source reads as "we searched and found nothing" rather than "there is nothing here yet", and
 * those are different statements about the organization.
 */
export async function resolveExternalRecipientSource(
  tenant: TenantContext | null,
  deps: RecipientEvidenceDeps = {},
): Promise<SourceResolution> {
  if (typeof window !== "undefined") {
    throw new Error("Recipient evidence is server-only.");
  }
  if (!tenant?.tenantId) return unavailable("No authorized tenant context was supplied.");

  const listing = await listActiveRecipients(tenant, deps);
  if (listing.unavailableReason) return unavailable(listing.unavailableReason);

  if (listing.recipients.length === 0) {
    return unavailable(
      "Your organization has recorded no recipients. A recipient is added by a person in Operations; none has been yet.",
    );
  }

  return {
    sourceClass: "external-recipients",
    state: "resolved",
    provenance: RECIPIENT_PROVENANCE,
    authoritative: false,
    /*
     * ── THE ADDRESS IS DELIBERATELY NOT IN THE EVIDENCE ITEM ──────────────────
     *
     * `ResolvedSourceItem.content` carries verbatim source text into the MODEL'S GROUNDING
     * CONTEXT, which is how a Knowledge statement reaches Heby. Putting an address there would
     * ship a third party's personal data to the model provider on every turn that touches
     * recipients — and nothing needs it there. Heby only ever needs the REFERENCE: it proposes
     * `recipientRef`, never an address, and `send-external-communication` takes a `record-ref`
     * rather than a string address precisely so a model cannot name a destination.
     *
     * The human who approves the send does need to see where it goes, and they get it from a
     * server-side resolve at the approval surface — not from Heby's context window.
     *
     * `detail` is machine-derived and flows into Heby's OWN prose, which the response validator
     * scans for claims Heby must never make. So it states the channel and stops: no "verified",
     * no "reachable", no "confirmed".
     */
    items: listing.recipients.map((recipient) => ({
      recordRef: recipient.recordRef,
      label: recipient.displayName,
      detail: `${recipient.endpointKind} · recorded address`,
      lifecycle: "settled" as const,
    })),
  };
}
