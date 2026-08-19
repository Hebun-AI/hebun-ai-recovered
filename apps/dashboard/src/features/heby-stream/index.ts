/*
 * heby-stream — G7. The contextual rail's view model.
 *
 * Pure and client-safe: no database, no clock, no authority, no read of its own. It only projects
 * rows a server read already returned into the shape the rail renders, and it has no branch that
 * can produce an entry without a row behind it.
 */

export * from "./activity-stream";
