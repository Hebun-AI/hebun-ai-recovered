/*
 * heby-commands/operational-planning-projection.server.ts — CONTROLLED AGENT REASONING · PHASE 2.
 *
 * The operational planning projection: what Hebun COULD show a model about this organization's work,
 * derived from two released, tenant-scoped Work reads and checked against the EAI
 * `operational-record` contract. Nothing here sends it anywhere. No runtime path imports this module;
 * no purpose, platform cell or tenant scope exists that would let it cross. It is not a plan, not a
 * model input and not a record.
 *
 * ── WHERE EACH VALUE COMES FROM ──────────────────────────────────────────────
 *
 *   state             `WorkItemView.declaredState`, Work's own enum — DECLARED by a human
 *   accountable       `accountableActorId !== null` — a human is RECORDED accountable; never who, and
 *                     not whether that person is still an active member
 *   stale             `isStale` — `/plan`'s own 30-day rule over the record's last change time
 *   evidenceDeclared  the WEV-1 seam (`readWorkEvidenceReferences`) lists a CURRENT declaration for this
 *                     item. `false` means Work records no current declaration for it — never that no
 *                     evidence exists in the world. A read that failed, or that reached its bound and
 *                     may be incomplete, makes the whole projection unavailable instead of `false`.
 *
 * Retired work is excluded. The department is `/plan`'s filter (`matchesDepartment`) over a scope the
 * caller already resolved through Organization Authority; the name never enters the projection.
 *
 * ── ALIASES ARE NOT AUTHORITY ────────────────────────────────────────────────
 *
 * `W1..Wn` follow the register's own order (newest recorded first) and exist for ONE invocation. The
 * alias → work item map is returned beside the projection, never inside it, and as a `Map` so that
 * serializing the result by accident carries no identifier. It is built from this tenant's own
 * register; an alias resolves only in the map that minted it and grants nothing.
 *
 * ── FAIL CLOSED, NEVER PARTIAL ───────────────────────────────────────────────
 *
 * An unreadable or truncated register, an unreadable or possibly incomplete evidence read, an empty
 * scope or more than the contract's bound all return `unavailable` with a fixed reason. Nothing is
 * truncated, guessed or filled in. Server-only, read-only: no write, no model, no Governance, no permit.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  OPERATIONAL_PLANNING_MAX_ITEMS,
  validateOperationalPlanningProjection,
  type OperationalProjectionRefusal,
} from "@/features/external-ai-data-use/operational-record-contract";
import { readWorkRegister, type WorkRegister } from "@/features/organizational-work/read-work.server";
import {
  MAX_WORK_EVIDENCE_REFERENCES,
  readWorkEvidenceReferences,
  type WorkEvidenceRead,
} from "@/features/organizational-work/read-work-evidence.server";
import type { WorkDeclaredState } from "@/features/organizational-work/work-contracts";
import { isStale, matchesDepartment } from "./action-plan";

export interface OperationalPlanningItem {
  readonly alias: string;
  readonly state: WorkDeclaredState;
  readonly accountable: boolean;
  readonly stale: boolean;
  readonly evidenceDeclared: boolean;
}

export type OperationalPlanningUnavailable =
  | "no-tenant"
  | "register-unavailable"
  | "register-truncated"
  | "evidence-unavailable"
  | "evidence-incomplete"
  | "nothing-in-scope"
  | "too-many-items"
  | "contract-refused";

export type OperationalPlanningProjection =
  | {
      readonly status: "projected";
      readonly projection: { readonly items: readonly OperationalPlanningItem[] };
      readonly dataClasses: readonly ["operational-record"];
      /** alias → work item id. Server-side only; never part of the projection. */
      readonly aliases: ReadonlyMap<string, string>;
    }
  | {
      readonly status: "unavailable";
      readonly reason: OperationalPlanningUnavailable;
      readonly refusal?: OperationalProjectionRefusal;
    };

const unavailable = (reason: OperationalPlanningUnavailable): OperationalPlanningProjection => ({ status: "unavailable", reason });

/** Pure. Both reads must be this tenant's own — `readOperationalPlanningProjection` guarantees it. */
export function projectOperationalPlanning(input: {
  readonly register: WorkRegister;
  readonly evidence: WorkEvidenceRead;
  /** A department name Organization Authority already resolved, or empty for the whole organization. */
  readonly scope: string;
  readonly now: Date;
}): OperationalPlanningProjection {
  if (input.register.status === "unavailable") return unavailable("register-unavailable");
  if (input.register.truncated) return unavailable("register-truncated");
  if (input.evidence.status === "unavailable") return unavailable("evidence-unavailable");
  /* The seam returns at most its bound and says nothing about more; a full page may be partial. */
  if (input.evidence.references.length >= MAX_WORK_EVIDENCE_REFERENCES) return unavailable("evidence-incomplete");

  const wanted = input.scope.trim().toLowerCase();
  const items = input.register.items.filter((item) => item.inService && (!wanted || matchesDepartment(item, wanted)));
  if (items.length === 0) return unavailable("nothing-in-scope");
  if (items.length > OPERATIONAL_PLANNING_MAX_ITEMS) return unavailable("too-many-items");

  const declared = new Set(input.evidence.references.map((reference) => reference.workItemId));
  const aliases = new Map<string, string>();
  const projection = {
    items: items.map((item, index): OperationalPlanningItem => {
      const alias = `W${index + 1}`;
      aliases.set(alias, item.workItemId);
      return {
        alias,
        state: item.declaredState,
        accountable: item.accountableActorId !== null,
        stale: isStale(item, input.now),
        evidenceDeclared: declared.has(item.workItemId),
      };
    }),
  };

  const verdict = validateOperationalPlanningProjection(projection);
  if (!verdict.ok) return { status: "unavailable", reason: "contract-refused", refusal: verdict.refusal };
  return { status: "projected", projection, dataClasses: verdict.dataClasses, aliases };
}

export interface OperationalPlanningReadDeps {
  readonly readWork?: typeof readWorkRegister;
  readonly readEvidence?: typeof readWorkEvidenceReferences;
  readonly now?: () => Date;
}

/** Both Work reads for the SAME authenticated tenant, then the pure projection. */
export async function readOperationalPlanningProjection(
  tenant: TenantContext | null,
  scope: string,
  deps: OperationalPlanningReadDeps = {},
): Promise<OperationalPlanningProjection> {
  if (typeof window !== "undefined") throw new Error("The operational planning projection is server-only.");
  if (!tenant?.tenantId) return unavailable("no-tenant");
  const [register, evidence] = await Promise.all([
    (deps.readWork ?? readWorkRegister)(tenant),
    (deps.readEvidence ?? readWorkEvidenceReferences)(tenant),
  ]);
  return projectOperationalPlanning({ register, evidence, scope, now: (deps.now ?? (() => new Date()))() });
}
