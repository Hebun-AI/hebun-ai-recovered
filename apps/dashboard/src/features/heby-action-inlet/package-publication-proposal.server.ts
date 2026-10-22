/*
 * heby-action-inlet/package-publication-proposal.server.ts — CONTENT-PUBLISH-FROM-PACKAGE-1: file the
 * existing governed publish proposal for a READY Content Package, from the package itself.
 *
 * A human on /operations names a draft revision and nothing else (plus, for YouTube, the four facts
 * only a human can declare). This module reads the revision's Content Package from Content
 * Composition, takes the ONE publishable medium the package already chose, and hands the result to
 * the released propose dispatcher (`runHebyProposeCommand`) as exactly the `/publish` or
 * `/publish-youtube` command a person could type in /heby. The dispatcher re-consults the command
 * registry and calls the destination inlet, which re-resolves the draft, re-checks readiness, the
 * duplicate guard and the connection, and files ONE pending request through R3A's writer. This module
 * writes nothing itself and adds no rule the inlets do not already enforce; the readiness and choice
 * checks here only spare the human a confusing refusal.
 *
 *   artifact + revision → Content Package → the chosen medium → propose dispatcher → destination
 *     inlet → pending request on /approvals
 *
 * PREPARED IS NOT AUTHORIZED. No permit, no attempt, no provider write. The proposer is the human
 * whose session this is; there is no agent entry point.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { readContentPackage } from "@/features/content-composition/read-content-package.server";
import { formatWorkArtifactRef } from "@/features/work-artifacts/artifact-ref";
import {
  runHebyProposeCommand,
  type HebyProposeCommandDeps,
  type HebyProposeCommandOutcome,
} from "./propose-commands.server";

export interface PackagePublicationProposalInput {
  readonly artifactId: string;
  readonly revisionNo: number;
  /** Required exactly when the package is for YouTube: the human's own declarations, never inferred. */
  readonly youtube?: {
    readonly privacyStatus: string;
    readonly categoryId: string;
    readonly madeForKids: string;
    readonly syntheticMedia: string;
  };
  /** DUPLICATE-GUARD-1 — the prior attempt an intentional new publication acknowledges, if any. */
  readonly acknowledgesPriorAttemptId?: string;
}

type PublishOutcome = Extract<HebyProposeCommandOutcome, { readonly kind: "publish-instagram" | "publish-youtube" }>;
type InletRefusal = Extract<PublishOutcome["result"], { readonly status: "refused" }>["reason"];

export type PackagePublicationRefusal =
  | InletRefusal
  /* The registry no longer offers this publish command. */
  | "not-proposable"
  /* The package's destination has no governed publishing path. */
  | "destination-not-publishable"
  /* The package holds no approved medium of the kind this destination publishes. */
  | "no-publishable-media"
  /* It holds more than one — a post carries one; the human removes the others first. */
  | "media-choice-ambiguous";

export type PackagePublicationProposalResult =
  | {
      readonly status: "proposed";
      readonly destination: "instagram" | "youtube";
      readonly requestId: string;
      /** YouTube only — the channel YouTube named for this connection. */
      readonly channelTitle?: string;
    }
  | {
      readonly status: "refused";
      readonly reason: PackagePublicationRefusal;
      readonly detail?: string;
      /** DUPLICATE-GUARD-1 — the latest consequential attempt a new publication would acknowledge. */
      readonly priorAttemptId?: string;
    };

export interface PackagePublicationProposalDeps extends Omit<HebyProposeCommandDeps, "resolveTenant"> {
  readonly readPackage?: typeof readContentPackage;
  readonly propose?: typeof runHebyProposeCommand;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const LATEST_ATTEMPT = /^latest-attempt=([0-9a-f-]{36})$/;

const refused = (reason: PackagePublicationRefusal, detail?: string): PackagePublicationProposalResult => {
  const prior = detail?.match(LATEST_ATTEMPT)?.[1];
  return { status: "refused", reason, ...(detail ? { detail } : {}), ...(prior ? { priorAttemptId: prior } : {}) };
};

export async function proposePackagePublication(
  tenant: TenantContext | null,
  input: PackagePublicationProposalInput | null,
  deps: PackagePublicationProposalDeps = {},
): Promise<PackagePublicationProposalResult> {
  if (typeof window !== "undefined") throw new Error("Action proposals are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (
    !input ||
    !UUID.test(input.artifactId ?? "") ||
    !Number.isInteger(input.revisionNo) ||
    input.revisionNo < 1 ||
    (input.acknowledgesPriorAttemptId !== undefined && !UUID.test(input.acknowledgesPriorAttemptId))
  ) {
    return refused("invalid-input");
  }

  const read = await (deps.readPackage ?? readContentPackage)(
    tenant,
    { artifactId: input.artifactId, revisionNo: input.revisionNo },
    deps,
  );
  if (read.status === "unavailable") return refused("persistence-unavailable");
  if (read.status !== "read") return refused("draft-not-found");
  const pkg = read.package;
  if (pkg.destination !== "instagram" && pkg.destination !== "youtube") return refused("destination-not-publishable");
  if (!pkg.ready) return refused("package-not-ready", pkg.blockers.join(","));
  if (pkg.destination === "youtube" && !input.youtube) return refused("invalid-input");

  const kind = pkg.destination === "instagram" ? "image" : "video";
  const chosen = pkg.selected.filter(
    (m) => m.mediaKind === kind && m.lifecycle === "admitted" && pkg.mediaReviewStates[m.mediaAssetId] === "approved",
  );
  if (chosen.length === 0) return refused("no-publishable-media");
  if (chosen.length > 1) return refused("media-choice-ambiguous", String(chosen.length));
  const medium = chosen[0]!.mediaAssetId;

  const draftRef = formatWorkArtifactRef(pkg.artifactId, pkg.revisionNo);
  const ack = input.acknowledgesPriorAttemptId ? [input.acknowledgesPriorAttemptId] : [];
  /* Exactly the arguments `/publish` and `/publish-youtube` take, in their order. */
  const command =
    pkg.destination === "instagram"
      ? { commandId: "publish", args: [draftRef, medium, ...ack] }
      : {
          commandId: "publish-youtube",
          args: [
            draftRef,
            medium,
            input.youtube!.privacyStatus,
            input.youtube!.categoryId,
            input.youtube!.madeForKids,
            input.youtube!.syntheticMedia,
            ...ack,
          ],
        };

  const outcome = await (deps.propose ?? runHebyProposeCommand)(command, { ...deps, resolveTenant: async () => tenant });
  if (outcome.status === "unauthorized") return refused("unauthenticated");
  if (outcome.status === "refused") return refused(outcome.reason === "invalid-arguments" ? "invalid-input" : "not-proposable");
  if (outcome.kind === "publish-instagram") {
    return outcome.result.status === "proposed"
      ? { status: "proposed", destination: "instagram", requestId: outcome.result.requestId }
      : refused(outcome.result.reason, outcome.result.detail);
  }
  if (outcome.kind === "publish-youtube") {
    return outcome.result.status === "proposed"
      ? { status: "proposed", destination: "youtube", requestId: outcome.result.requestId, channelTitle: outcome.result.channelTitle }
      : refused(outcome.result.reason, outcome.result.detail);
  }
  return refused("not-proposable");
}
