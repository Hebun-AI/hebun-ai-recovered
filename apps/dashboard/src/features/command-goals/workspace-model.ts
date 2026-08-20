/*
 * command-goals/workspace-model.ts — the read model for Command · Strategic Goals.
 *
 * ── CMD-0: WHAT THIS FILE USED TO CLAIM, AND WHY IT WAS FALSE ────────────────
 *
 * Phase 20B pinned the goal authority to `goal-runtime` and reported its output as
 * "derived from the knowledge graph (Goal Registry)", with `connected: goals.length > 0`.
 * Both halves of that sentence were wrong about the product.
 *
 * `goal-runtime` projects Goal nodes out of the shared in-memory persistence store, and that
 * store's ENTIRE content is a compiled-in seed:
 *
 *   src/features/registries/records.ts   (4 literal goal rows: GO-101…GO-104)
 *     -> knowledge-graph/graph-builder   (registry records -> graph nodes)
 *       -> knowledge-crud/node-adapter   (seed(), every node forced lifecycleStatus "active",
 *                                         createdBy/updatedBy "Seed")
 *         -> runtime-projection goal-projection-builder
 *           -> GoalRuntimeService.listGoals()
 *
 * It is not canonical Knowledge — `getAdapter` resolves to the MEMORY adapter (the postgres and
 * supabase cases are commented out), so nothing on this path has ever read the tenant's knowledge
 * nodes. It is not tenant-scoped either: not one function on that chain takes a tenant.
 *
 * So the released surface told a real authenticated tenant that THEIR organization holds four
 * strategic goals — "Reduce churn below 8%", "Launch enterprise tier", "SOC2 readiness", and an
 * archived "Legacy CRM sunset" that survives the active filter only because the seeder forces
 * every node active. That is false organizational standing, and it is precisely what the G2 mock
 * gate exists to prevent; the gate simply was not consulted here.
 *
 * ── THE REPAIR ───────────────────────────────────────────────────────────────
 *
 * WITHHELD, NOT RELABELLED. Marking the four rows "Seeded" and showing them anyway would still
 * tell the Director their organization has a SOC2 readiness goal. The G2 precedent is to withhold
 * the whole projection rather than partially trust it, and this file follows it by reusing that
 * gate — the same authority, no new signal, no second opinion about who is looking.
 *
 * NO BOOLEAN A SEED CAN TURN TRUE. `connected` is gone. Both facts this model states are DERIVED
 * from something outside it and cannot go stale the way a literal does:
 *
 *   withheld     from the existing demo gate — is a real tenant reachable right now?
 *   provenance   from the persistence provider — while the store is `memory`, everything it can
 *                return is `seed()`. If a durable store is ever wired, this reads `unverified`,
 *                never "authoritative": establishing a goal authority is a separate gate and this
 *                file may not award one by changing a string.
 *
 * This model creates no goal authority, no repository, no table, no writer, no tenant projection,
 * and no connection to canonical Knowledge. It only stops an existing seed from being presented
 * as organizational truth.
 */

import { organizationalDemoDataPermitted } from "@/features/mock-surface-gating/gate.server";
import { activeProvider } from "@/features/persistence/storage-manager";
import { GoalRuntimeService, type GoalRuntimeModel } from "@/features/goal-runtime";

/**
 * What kind of claim the listed goals are. There is deliberately no "authoritative" member: no
 * value this model can compute is allowed to mean "this organization declared these goals".
 */
export type GoalProvenance = "seeded" | "unverified";

export interface StrategicGoalsModel {
  /** Empty whenever `withheld`. Never a fabricated goal, target, percentage, owner, or date. */
  readonly goals: readonly GoalRuntimeModel[];
  /** What the listed goals are. Derived from the store, never asserted. */
  readonly provenance: GoalProvenance;
  /** Honest description of where the rows come from. Names the seed, not a knowledge graph. */
  readonly source: string;
  /** True when a real tenant is reachable: the projection is withheld rather than presented. */
  readonly withheld: boolean;
}

const SEEDED_SOURCE =
  "goal-runtime — a compiled-in registry seed in the in-memory store, not an organizational goal authority";
const UNVERIFIED_SOURCE =
  "goal-runtime — a durable store of unproven provenance; no goal authority has been established";

/**
 * Build the Strategic Goals model.
 *
 * Withholds the whole projection wherever a real tenant can be authenticated. Fabricates nothing,
 * writes nothing, and resolves no tenant — it does not need one, because it refuses to answer at
 * all rather than answering per tenant from a source that has no tenant.
 */
export function getStrategicGoalsModel(): StrategicGoalsModel {
  const provenance: GoalProvenance = activeProvider() === "memory" ? "seeded" : "unverified";
  const source = provenance === "seeded" ? SEEDED_SOURCE : UNVERIFIED_SOURCE;

  if (!organizationalDemoDataPermitted()) {
    return { goals: [], provenance, source, withheld: true };
  }

  return { goals: GoalRuntimeService.listGoals(), provenance, source, withheld: false };
}
