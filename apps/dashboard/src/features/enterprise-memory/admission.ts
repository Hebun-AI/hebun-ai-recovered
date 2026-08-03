/**
 * Enterprise Memory — admission concepts.
 *
 * These types describe the *states* a memory can occupy on the path from
 * proposal to durable knowledge. They are concepts only: no workflow, no
 * transition logic, no persistence, no authority evaluation. Behavior that moves
 * a memory between these states is out of scope for this phase.
 */

import type {
  MemoryLifecycleState,
  MemoryRecord,
  MemoryTimestamp,
} from "@/features/enterprise-memory/contracts";

/** Narrows a MemoryRecord to a specific lifecycle state at the type level. */
type MemoryInState<State extends MemoryLifecycleState> = MemoryRecord & {
  readonly lifecycle: { readonly state: State };
};

/** Knowledge proposed for admission; not yet admitted. */
export type MemoryCandidate = MemoryInState<"candidate">;

/** Knowledge admitted under explicit authority. */
export type ApprovedMemory = MemoryInState<"approved">;

/** Knowledge that was considered and denied admission. */
export type RejectedMemory = MemoryInState<"rejected">;

/** Previously admitted knowledge retired from active standing. */
export type ArchivedMemory = MemoryInState<"archived">;

/** The decision recorded when a candidate is admitted or denied. */
export type MemoryAdmissionDecision = "approved" | "rejected";

/**
 * The metadata of an admission decision. This is a record of what was decided —
 * not a process, a workflow step, or an authorization mechanism.
 */
export interface MemoryAdmission {
  readonly decision: MemoryAdmissionDecision;
  readonly grantReference: string;
  readonly decidedAt: MemoryTimestamp;
  readonly reason?: string;
}
