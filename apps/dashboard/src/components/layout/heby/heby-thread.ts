/*
 * heby-thread.ts — pure thread composition (H1C). No React, no actions, no authority.
 *
 * Composes the rendered `turns` from the DURABLE messages (the sole transcript authority) plus,
 * only when the latest answer was not durably saved, a single ephemeral session-only turn.
 * Evidence + a richer provider-state provenance are attached to the newest Heby turn; restored
 * history shows provenance from its own durable origin/transport (evidence is not persisted). No
 * database id is ever placed into rendered content — ids are React keys only.
 */
import type { HebyRuntimeResponse } from "@/features/heby-runtime";
import type { HebyTurnView } from "./heby-turns";
import { describeMessageProvenance, deriveLatestProvenance } from "./heby-provenance";

/** The minimal durable-message shape the thread needs (a superset arrives from the loader). */
export interface ThreadMessage {
  readonly id: string;
  readonly role: string;
  readonly content: string;
  readonly origin?: string | null;
  readonly transport?: string | null;
}

export interface LatestTurn {
  readonly userText: string;
  readonly response: HebyRuntimeResponse;
  readonly durable: boolean;
}

export function buildTurns(
  messages: readonly ThreadMessage[],
  latest: LatestTurn | null,
): readonly HebyTurnView[] {
  const turns: HebyTurnView[] = messages.map((message) => {
    const isHeby = message.role !== "user";
    return {
      key: message.id,
      role: isHeby ? "heby" : "user",
      content: message.content,
      provenance: isHeby ? describeMessageProvenance(message.origin, message.transport) : null,
      durable: true,
    };
  });

  // The newest durable Heby turn IS the latest answer: attach its evidence + richer provenance.
  if (latest?.durable) {
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i]!.role === "heby") {
        turns[i] = {
          ...turns[i]!,
          provenance: deriveLatestProvenance(latest.response),
          evidence: latest.response.evidence.map((e) => ({ sourceClass: e.sourceClass, recordRef: e.recordRef })),
          limitations: latest.response.limitations,
        };
        break;
      }
    }
  }

  // Persistence not configured/failed: show the latest turn for this session only (never durable).
  if (latest && !latest.durable) {
    turns.push({ key: "ephemeral-user", role: "user", content: latest.userText, durable: false });
    turns.push({
      key: "ephemeral-heby",
      role: "heby",
      content: latest.response.body.join("\n"),
      provenance: deriveLatestProvenance(latest.response),
      durable: false,
      evidence: latest.response.evidence.map((e) => ({ sourceClass: e.sourceClass, recordRef: e.recordRef })),
      limitations: latest.response.limitations,
    });
  }

  return turns;
}
