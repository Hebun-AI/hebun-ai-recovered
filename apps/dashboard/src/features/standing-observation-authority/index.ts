/*
 * standing-observation-authority — Governance's permission to observe one exact provider read
 * scope, repeatedly, until a later revision withdraws it (TRH-23).
 *
 * This barrel re-exports the CONTRACTS only. The writer, the reader, the ephemeral principal and the
 * pre-transport revalidator are `.server.ts` modules and are imported directly by the small number
 * of callers entitled to reach them — a barrel that re-exported them would make the authority look
 * ambiently available from anywhere, which is the opposite of what it is.
 */
export * from "./contracts";
