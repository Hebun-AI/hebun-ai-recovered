"use server";

/*
 * CONTENT-PUBLISH-FROM-PACKAGE-1 — the /operations boundary that files a publish proposal for a READY
 * Content Package.
 *
 * A file of its own, not a sixteenth export of `operations/actions.ts`: that file is the Media door
 * and may not reach any act authority (tests/media1-asset-authority). Filing a proposal is an act
 * authority's job, so it crosses here, into the action inlet, and nowhere else.
 *
 * WHAT THE CLIENT MAY SUPPLY, EXHAUSTIVELY: the revision (artifact id + revision number), the four
 * YouTube declarations, and an acknowledged prior attempt id. No tenant, actor, action kind, medium,
 * digest, permit or approval is representable here. The tenant is the session's; the medium is the
 * one the package chose; the inlet re-checks everything before it files.
 *
 * NOTHING IS APPROVED, AUTHORIZED OR EXECUTED. The result is a pending request on /approvals, or a
 * typed refusal.
 */
import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  proposePackagePublication,
  type PackagePublicationProposalResult,
} from "@/features/heby-action-inlet/package-publication-proposal.server";

export async function proposePackagePublicationAction(input: {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly youtube?: {
    readonly privacyStatus: string;
    readonly categoryId: string;
    readonly madeForKids: string;
    readonly syntheticMedia: string;
  };
  readonly acknowledgesPriorAttemptId?: string;
}): Promise<PackagePublicationProposalResult> {
  const tenant = await resolveTenantContext();
  const result = await proposePackagePublication(tenant, {
    artifactId: input?.artifactId,
    revisionNo: input?.revisionNo,
    ...(input?.youtube
      ? {
          youtube: {
            privacyStatus: input.youtube.privacyStatus,
            categoryId: input.youtube.categoryId,
            madeForKids: input.youtube.madeForKids,
            syntheticMedia: input.youtube.syntheticMedia,
          },
        }
      : {}),
    ...(input?.acknowledgesPriorAttemptId ? { acknowledgesPriorAttemptId: input.acknowledgesPriorAttemptId } : {}),
  });
  if (result.status === "proposed") {
    revalidatePath("/operations");
    revalidatePath("/approvals");
  }
  return result;
}
