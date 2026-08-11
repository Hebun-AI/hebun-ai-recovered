/*
 * heby-commands — Heby's slash-command layer (S1).
 *
 * ONE registry, ONE parser, ONE dispatch planner, shared by both Heby surfaces. Commands are an
 * interaction affordance: a command may request a capability, and can never grant itself the
 * authority to use one.
 *
 * The server-side read executor is deliberately NOT re-exported here — this index is imported by
 * client code, and `read-commands.server.ts` must be reached only through the server action.
 */

export * from "./contracts";
export * from "./registry";
export * from "./parser";
export * from "./dispatch";
export * from "./advisory-prompts";
