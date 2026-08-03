/**
 * Enterprise Memory Context — deterministic assembly engine.
 *
 * Pipeline: validate → deduplicate → order → bound → group → preserve reasons.
 * Pure: no hidden state, no cache, no singleton, no randomness, no reflection, no
 * plugin registration. Identical selection input and policy always produce an
 * identical, immutable assembled context. Records and their selection reasons are
 * preserved verbatim — nothing is summarized, synthesized, or reinterpreted.
 */

import type { SelectedMemoryContext, SelectionReason } from "@/features/enterprise-memory-selection";
import type {
  AssembledContext,
  AssembledEntry,
  AssembledGroup,
  AssemblyPolicy,
  AssemblyResult,
} from "@/features/enterprise-memory-context/contracts";
import { deduplicate } from "@/features/enterprise-memory-context/dedup";
import { groupRecords } from "@/features/enterprise-memory-context/grouping";
import { orderRecords } from "@/features/enterprise-memory-context/ordering";

function reasonKey(memoryId: string, version: number): string {
  return `${memoryId} ${version}`;
}

/** Indexes selection reasons by memory id and version for verbatim preservation. */
function indexReasons(reasons: readonly SelectionReason[]): ReadonlyMap<string, SelectionReason> {
  const index = new Map<string, SelectionReason>();
  for (const reason of reasons) index.set(reasonKey(reason.memoryId, reason.version), reason);
  return index;
}

export function assembleContext(selection: SelectedMemoryContext, policy: AssemblyPolicy): AssemblyResult {
  if (policy.limit !== undefined && (policy.limit < 0 || !Number.isInteger(policy.limit))) {
    return { status: "ValidationFailure", issues: ["limit must be a non-negative integer"] };
  }

  const reasonIndex = indexReasons(selection.reasons);

  const deduped = deduplicate(selection.selected, policy.dedup ?? "none");
  const ordered = orderRecords(deduped, policy.order ?? "preserve-selection");
  const bounded = policy.limit === undefined ? ordered : ordered.slice(0, policy.limit);
  const groups = groupRecords(bounded, policy.groupBy ?? "none");

  const assembledGroups: readonly AssembledGroup[] = Object.freeze(
    groups.map((group) => {
      const entries: readonly AssembledEntry[] = Object.freeze(
        group.records.map((record) => {
          const reason = reasonIndex.get(reasonKey(record.writeIdentity.memoryId, record.writeIdentity.version));
          const entry: AssembledEntry = reason === undefined ? { record } : { record, selectionReason: reason };
          return Object.freeze(entry);
        }),
      );
      return Object.freeze({ key: group.key, entries });
    }),
  );

  const context: AssembledContext = {
    groups: assembledGroups,
    totalRecords: bounded.length,
    sourceSelectionSize: selection.selected.length,
    appliedPolicy: policy,
  };
  return { status: "Success", value: Object.freeze(context) };
}
