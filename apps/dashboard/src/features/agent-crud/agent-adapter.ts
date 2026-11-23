/*
 * Agent CRUD — persistence adapter binding.
 *
 * P5-1: the store starts empty. It used to seed itself from a compiled-in mock; a real tenant's
 * agents are durable records owned elsewhere, never fixtures loaded at start.
 */

import { getAdapter } from "@/features/persistence";
import type { AgentCrudRecord } from "./types";

function seed(): AgentCrudRecord[] {
  return [];
}

export const agentAdapter = getAdapter<AgentCrudRecord>("agents", seed);

export const subscribe = agentAdapter.subscribe;
export const getSnapshot = agentAdapter.getSnapshot;

export async function resetStore(): Promise<void> {
  await agentAdapter.save(seed());
}
