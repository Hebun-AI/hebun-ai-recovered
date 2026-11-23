/*
 * Workflow CRUD — persistence adapter binding.
 *
 * P5-1: the store starts empty. It used to seed itself from a compiled-in mock; a real tenant's
 * workflows are durable records owned elsewhere, never fixtures loaded at start.
 */

import { getAdapter } from "@/features/persistence";
import type { WorkflowCrudRecord } from "./types";

function seed(): WorkflowCrudRecord[] {
  return [];
}

export const workflowAdapter = getAdapter<WorkflowCrudRecord>("workflows", seed);

export const subscribe = workflowAdapter.subscribe;
export const getSnapshot = workflowAdapter.getSnapshot;

export async function resetStore(): Promise<void> {
  await workflowAdapter.save(seed());
}
