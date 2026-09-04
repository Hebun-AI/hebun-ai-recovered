/*
 * operations-preparation.tsx — the Operations Preparation surface (OPS-P1).
 *
 * ── WHAT THIS COMPLETES, AND WHAT IT DELIBERATELY IS NOT ─────────────────────
 *
 * R3R made a recipient durable and R3W made a prepared draft durable. Both shipped with an
 * authority, a reader, a reference format and server actions — and no interface, so a human could
 * not reach either. `/send` needs the two canonical references those authorities mint, and until
 * now there was nowhere to obtain them. This is the missing VIEW LAYER and nothing more: it owns no
 * state, mints no reference, and every write goes through a server action that already shipped.
 *
 * IT LIVES ON `/operations` BECAUSE THE ACTION REGISTRY SAYS SO. Both tools that can ever name an
 * artifact as a `record-ref` — `heby.operations.prepare-plan` and
 * `heby.operations.send-communication` — declare `ownerWorkspace: "operations"`. No fifth L2
 * destination is added and no navigation changes: the released Operations L2 is exactly
 * `Overview · Execution · Runtime & Signals · Execution Substrate`, a deepEqual pin, and this
 * surface renders inside the workspace root rather than beside it.
 *
 * ── PREPARATION IS NOT PROPOSAL ──────────────────────────────────────────────
 *
 * Nothing here proposes, approves, authorizes, executes or sends. There is no "Prepare for
 * approval" control and no second caller of the proposal inlet: `recordActionRequest` keeps the one
 * caller R3A.1 gave it, and `/send` in Heby remains the only way a proposal is filed. What this
 * surface produces are the INPUTS a human then names in that command.
 *
 * Server component. It reads both listings and hands finished data to the two client sections; it
 * holds no client state and offers no mutation of its own.
 */
import {
  listActiveRecipientsAction,
  listRetiredRecipientsAction,
  listWorkArtifactsAction,
  readArtifactWorkPurposeAction,
} from "@/app/(dashboard)/operations/actions";
import { RecipientsSection } from "./recipients-section";
import { PreparedWorkSection } from "./prepared-work-section";

export async function OperationsPreparation() {
  /*
   * REV-3 adds one more independent read to the same parallel fetch. It is the Work Authority's
   * relationship, read through its own released seam, and it is composed HERE rather than inside
   * the artifact reader — `read-work-evidence.server.ts` already imports `listWorkArtifacts`, so
   * folding the inverse into that reader would close an import cycle and make the artifact
   * authority a participant in a relationship it does not own.
   */
  const [active, retired, artifacts, workPurpose] = await Promise.all([
    listActiveRecipientsAction(),
    listRetiredRecipientsAction(),
    listWorkArtifactsAction(),
    readArtifactWorkPurposeAction(),
  ]);

  return (
    <div className="mt-8 space-y-8">
      <RecipientsSection active={active} retired={retired} />
      <PreparedWorkSection listing={artifacts} workPurpose={workPurpose} />
    </div>
  );
}
