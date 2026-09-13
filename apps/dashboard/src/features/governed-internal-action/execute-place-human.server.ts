/*
 * governed-internal-action/execute-place-human.server.ts — THE SECOND GOVERNED INTERNAL ACT (GIA-2).
 *
 * ── WHY THIS IS A SECOND FILE AND NOT A GENERIC EXECUTOR ─────────────────────
 *
 * Two examples is exactly when the temptation to abstract appears, and exactly when abstracting is
 * least justified. GIA-1's header already refused a framework — "there is deliberately no framework
 * here for a second internal action" — and the reason survives contact with the second one: the two
 * acts differ in every part that matters. Different payload shape, different domain authority,
 * different refusal vocabulary, different notion of what makes a target real. What they share is
 * six lines of control flow, and a shared abstraction over six lines would have to be parameterised
 * by all four differences to earn its keep.
 *
 * A generic executor would also become the place where the NEXT kind is added by configuration
 * rather than by a reviewer reading a file like this one. The duplication here is the reviewable
 * unit: adding a third internal act means writing a third file that says what it does.
 *
 * ── THE FLOW, AND WHO OWNS EACH STEP ─────────────────────────────────────────
 *
 *   Heby or a human PROPOSES        heby_action_requests         (released)
 *   a human DECIDES                 decision_records             Governance (released)
 *   a permit EXISTS                 action_permits               Action Authorization (released)
 *   the permit is SPENT             consumeActionPermit          Action Authorization (released)
 *   the ORGANIZATION AUTHORITY      placeUnplacedHumanWithin     Organization Authority (GIA-2 seam)
 *     mutates
 *   the outcome is the placement row + its audit event, in that same transaction
 *
 * THIS MODULE OWNS NOTHING. It holds no table, opens no transaction of its own, resolves no
 * authority and performs no insert. It hands the permit's own transaction to the authority that
 * owns `department_placements` and lets that authority do the writing.
 *
 * ── WHAT IT VALIDATES, AND WHAT IT DELIBERATELY DOES NOT ─────────────────────
 *
 * It validates ITS OWN CONTRACT: that the permit authorizes THIS kind, and that the approved
 * payload names two references in the shapes this act is defined over. Everything about whether
 * those references describe real, eligible, in-tenant things is the AUTHORITY'S question, re-asked
 * inside the transaction under its own locks. Re-checking here would create a second, weaker copy
 * of the placement rules that could drift — the exact defect the OSA firewall exists to catch.
 *
 *     THE SEAM CHECKS THE ENVELOPE.      THE AUTHORITY CHECKS THE WORLD.
 *
 * ── THE GOVERNED ACT IS NARROWER THAN THE HUMAN ONE, DELIBERATELY ────────────
 *
 * It calls `placeUnplacedHumanWithin`, which places a human holding NO active placement and refuses
 * `already-placed` otherwise. The human path may MOVE somebody between departments; that needs an
 * `update`, and `PermitConsumptionTx` exposes only `insert` and `select` — a narrowing GIA-1's
 * firewall pins and records as "NOT WIDENED". Rather than widen the permit transaction for every
 * future governed act so this one could move people, the act was made smaller.
 *
 * ── WHY NOT `action_execution_attempts` ──────────────────────────────────────
 *
 * Same reason GIA-1 gave, and it is not symmetry-avoidance for its own sake. That ledger is
 * external-send specific in schema (`recipient_id` and `adapter_id` are NOT NULL) and in meaning:
 * it exists because a network send has an AMBIGUOUS PHASE — the request may have arrived even
 * though the caller never learned so. A placement written inside the permit's own transaction has
 * no ambiguous phase. It committed or it did not, and the placement audit event says which.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  consumeActionPermit,
  type PermitConsumptionDeps,
} from "@/features/action-authorization/consume-action-permit.server";
import type { ExecutionAuthorization } from "@/features/action-authorization/contracts";
import {
  placeUnplacedHumanWithin,
  type PlacementWriteResult,
} from "@/features/organization-authority/write-placement.server";
import { parseDepartmentRef } from "@/features/organization-authority/department-ref";
import { PLACE_HUMAN_ACTION_KIND } from "@/features/heby-action-inlet/contracts";

/** The one kind this seam performs. A constant, so no caller can aim it at another act. */
export const PLACEMENT_ACTION_KIND = PLACE_HUMAN_ACTION_KIND;

/** `user/<uuid>` — the reference shape a placement proposal names a human by. */
const USER_REF = /^user\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Why a governed placement did not happen. Each value is a fact about THIS invocation. */
export type PlacementActRefusal =
  /** No server-resolved tenant. There is no parameter through which a caller supplies one. */
  | "unauthenticated"
  /** The permit could not be spent — already spent, expired, revoked, or not this tenant's. */
  | "permit-not-consumable"
  /** The permit authorizes a different act. The transaction is aborted, so nothing was written. */
  | "action-kind-mismatch"
  /** The approved payload does not name a human and a department in the shapes this act uses. */
  | "payload-not-placeable"
  /** The Organization Authority refused. Its own reason is carried, never re-interpreted. */
  | "placement-authority-refused"
  /** The control plane could not be reached. Nothing was authorized and nothing was written. */
  | "execution-unavailable";

export type PlacementActResult =
  | {
      readonly status: "executed";
      /** The permit spend. Proof of EXECUTION, distinct from the mutation's success. */
      readonly handoffId: string;
      readonly permitId: string;
      /** The Organization Authority's own answer. Proof of SUCCESS, and its record, not ours. */
      readonly outcome: PlacementWriteResult;
    }
  | {
      readonly status: "refused";
      readonly reason: PlacementActRefusal;
      /** The owning authority's own refusal, when it is the one that refused. Never paraphrased. */
      readonly authorityReason?: string;
    };

export interface PlacementActDeps extends PermitConsumptionDeps {
  readonly consume?: typeof consumeActionPermit;
  readonly placeWithin?: typeof placeUnplacedHumanWithin;
}

class AbortPlacementAct extends Error {}

/**
 * The two references this act is defined over, or `null` when the payload is not one of them.
 *
 * SHAPE ONLY. That a uuid parses says nothing about whether the human is a member, whether the
 * department is in service, or whether either belongs to this tenant — all three are the
 * authority's questions, asked under its own locks a few lines later.
 */
function placementInputFrom(authorization: ExecutionAuthorization): {
  readonly userId: string;
  readonly departmentId: string;
} | null {
  const payload = authorization.canonicalPayload;

  const humanRef = payload["humanRef"];
  if (typeof humanRef !== "string") return null;
  const human = USER_REF.exec(humanRef.trim());
  if (!human) return null;

  const departmentRef = payload["departmentRef"];
  if (typeof departmentRef !== "string") return null;
  /* The released parser, so this seam cannot invent a second department reference grammar. */
  const department = parseDepartmentRef(departmentRef.trim());
  if (department === null) return null;

  return { userId: human[1]!.toLowerCase(), departmentId: department.departmentId };
}

/**
 * Perform one authorized placement.
 *
 * THE TENANT IS THE CALLER'S RESOLVED CONTEXT and the permit is named by id. There is no parameter
 * for a tenant, a human, a department or an authority — the act is entirely described by the permit
 * the Director already approved.
 */
export async function executePlaceHuman(
  tenant: TenantContext | null,
  input: { readonly permitId: string },
  deps: PlacementActDeps = {},
): Promise<PlacementActResult> {
  if (typeof window !== "undefined") {
    throw new Error("Governed internal acts are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };

  const consume = deps.consume ?? consumeActionPermit;
  const placeWithin = deps.placeWithin ?? placeUnplacedHumanWithin;

  let outcome: PlacementWriteResult | null = null;
  /* Captured before the throw, because the throw's identity does not survive the released catch. */
  let refusal: PlacementActRefusal | null = null;
  let authorityReason: string | undefined;

  const abort = (reason: PlacementActRefusal, detail?: string): never => {
    refusal = reason;
    authorityReason = detail;
    throw new AbortPlacementAct(reason);
  };

  let consumption: Awaited<ReturnType<typeof consumeActionPermit>>;
  try {
    consumption = await consume(
      tenant,
      { permitId: input.permitId },
      {
        ...deps,
        async onAuthorizedWithin(tx, authorization: ExecutionAuthorization) {
          /*
           * A permit for another kind cannot be substituted. Aborting here rolls the whole
           * transaction back, so a mismatched permit is not merely refused — it is not spent.
           */
          if (authorization.actionKind !== PLACEMENT_ACTION_KIND) abort("action-kind-mismatch");

          const placement = placementInputFrom(authorization);
          if (placement === null) abort("payload-not-placeable");

          /*
           * THE AUTHORITY WRITES, INSIDE THIS TRANSACTION. The permit spend and the placement
           * commit together or not at all, so "authorized but not placed" and "placed but
           * unauthorized" are both unrepresentable rather than merely unlikely.
           */
          const result = await placeWithin(tx, tenant, placement!, new Date());
          if (result.status !== "recorded") {
            abort(
              "placement-authority-refused",
              result.status === "refused" ? result.reason : result.status,
            );
          }
          outcome = result;
        },
      },
    );
  } catch {
    return { status: "refused", reason: refusal ?? "execution-unavailable" };
  }

  /*
   * The released consumer swallows an aborted callback into its own refusal shape, so the captured
   * reason is the truthful one and is preferred over whatever the consumer concluded.
   */
  if (refusal !== null) {
    return { status: "refused", reason: refusal, ...(authorityReason ? { authorityReason } : {}) };
  }
  if (consumption.status !== "authorized") {
    return { status: "refused", reason: "permit-not-consumable" };
  }
  if (outcome === null) return { status: "refused", reason: "execution-unavailable" };

  return {
    status: "executed",
    handoffId: consumption.authorization.handoffId,
    permitId: consumption.authorization.permitId,
    outcome,
  };
}
