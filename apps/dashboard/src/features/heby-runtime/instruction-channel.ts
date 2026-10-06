/*
 * heby-runtime/instruction-channel.ts — SCI-1. WHO MAY SPEAK IN THE INSTRUCTION CHANNEL.
 *
 * TB-1 (`trust-boundary.ts`) classifies `systemInstructions` as `trusted-system-instruction`: Hebun's
 * own words, "never assembled from retrieved material, and never contains tenant content". That was
 * a classification. This module makes it a construction rule the shared generator can check.
 *
 * A Hebun instruction is MINTED here, from text written in this repository, by a handful of named
 * files (a firewall test pins the census). Minted values can be JOINED, and a join of minted values
 * is minted. Nothing else is: there is no function that takes runtime data and returns an
 * instruction, so a draft, a Knowledge statement, a provider caption or a model reply cannot become
 * one by being concatenated in. The generator refuses, before any egress, a request whose
 * instruction channel is not exactly a minted value.
 *
 *     AUTHORIZED FOR DISCLOSURE != AUTHORIZED AS MODEL INSTRUCTION
 *
 * EAI decides whether a data class may leave; this decides only that data does not thereby become
 * instruction. It inspects no natural language, detects nothing and neutralizes nothing: it is an
 * identity check against values Hebun itself produced.
 *
 * WHAT IT DOES NOT GUARANTEE. The Claude transport still sends instruction and grounding in one
 * `system` string under `GROUNDING_CONTEXT_PREFIX` (see `MODEL_CONTEXT_BOUNDARY`). Moving tenant text
 * out of the instruction field moves it below Hebun's delimiter, not into a provider-enforced
 * channel. A model may still be persuaded by data. This rule removes the case where Hebun ITSELF put
 * data in its own instruction position.
 *
 * Server and client safe: no I/O. In-memory only; nothing persists.
 */

declare const hebunInstructionBrand: unique symbol;
/** Text only Hebun wrote. Obtainable only from {@link hebunInstruction} or {@link joinHebunInstructions}. */
export type HebunInstruction = string & { readonly [hebunInstructionBrand]: true };

/*
 * One set per process, even if a bundler loads this module twice (a server-action chunk and a route
 * chunk): a value minted in one copy must pass the check in the other, or every live call would fail.
 */
const MINTED_KEY = Symbol.for("hebun.sci1.minted-instructions");
const MINTED: Set<string> = ((globalThis as Record<symbol, Set<string> | undefined>)[MINTED_KEY] ??= new Set<string>());

/**
 * Mint Hebun-authored control text. CALL ONLY WITH TEXT WRITTEN IN THIS REPOSITORY — a constant, or
 * a sentence built from a closed vocabulary. Never with a variable holding tenant, provider, model
 * or conversation content. The callers are a pinned census.
 */
export function hebunInstruction(text: string): HebunInstruction {
  MINTED.add(text);
  return text as HebunInstruction;
}

/** A join of minted parts is minted. The only way to combine instructions. */
export function joinHebunInstructions(parts: readonly HebunInstruction[], separator = "\n\n"): HebunInstruction {
  for (const part of parts) {
    if (!MINTED.has(part)) throw new Error("instruction-channel: only minted instructions can be joined");
  }
  return hebunInstruction(parts.join(separator));
}

/** The generator's check: is this exactly a value Hebun minted? Identity, not inspection. */
export function isHebunInstruction(value: unknown): value is HebunInstruction {
  return typeof value === "string" && MINTED.has(value);
}
