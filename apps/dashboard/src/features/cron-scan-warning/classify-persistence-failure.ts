/*
 * cron-scan-warning/classify-persistence-failure.ts — WHY a runtime register could not be read, as
 * one closed word (SCAN-FAILURE-LEGIBILITY-1).
 *
 * ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
 *
 * The three `…ForRuntime` register readers turned every failure into `persistence-unavailable`, so a
 * 503 tick said that the register was unreadable and never why: an unconfigured deployment, a
 * connection that never opened, a refused login and a failing query were one fact.
 *
 * ── IT READS STRUCTURED CODES ONLY ───────────────────────────────────────────
 *
 * The only thing read from an error is a string `code` — on the error itself or on its `cause`
 * chain, a bounded number of levels deep. That is a PostgreSQL SQLSTATE (`pg`'s `DatabaseError`) or
 * a Node errno (a socket that could not connect). A message, a stack, a query or its parameters are
 * never read: `drizzle-orm`'s `DrizzleQueryError` puts the SQL AND ITS PARAMETERS in its message,
 * and those parameters can be tenant identifiers. A failure with no structured code — `pg-pool`'s
 * connect timeout is one — is `unknown`, by decision: free text decides nothing.
 *
 * Pure. No I/O, no logging; the caller decides what to do with the word.
 */

export const PERSISTENCE_FAILURE_CAUSES = Object.freeze([
  "not-configured",
  "connection",
  "authentication",
  "query",
  "unknown",
] as const);

export type PersistenceFailureCause = (typeof PERSISTENCE_FAILURE_CAUSES)[number];

/** How far down a `cause` chain a code is looked for. `DrizzleQueryError → pg error` is one level. */
const MAX_CAUSE_DEPTH = 4;

/** Node errno values that mean the socket to the database never worked. Closed; anything else is not one. */
const CONNECTION_ERRNO: ReadonlySet<string> = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
]);

const SQLSTATE = /^[0-9A-Z]{5}$/;

/**
 * SQLSTATE classes (the first two characters) that are about reaching the database rather than about
 * the statement: 08 connection exception, 3D invalid catalog (no such database), 53 insufficient
 * resources (too many connections), 57 operator intervention (shutdown, cannot connect now), 58 system
 * error. 28 is a refused login. Every other well-formed SQLSTATE came back FROM the database about a
 * statement, so it is `query`.
 */
const CONNECTION_SQLSTATE_CLASSES: ReadonlySet<string> = new Set(["08", "3D", "53", "57", "58"]);
const AUTHENTICATION_SQLSTATE_CLASS = "28";

function codeOf(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const code = (value as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function classifyCode(code: string): PersistenceFailureCause | undefined {
  /* Errno first: `EPIPE` is also five capitals, and is not a SQLSTATE. */
  if (CONNECTION_ERRNO.has(code)) return "connection";
  if (!SQLSTATE.test(code)) return undefined;
  const sqlClass = code.slice(0, 2);
  if (sqlClass === AUTHENTICATION_SQLSTATE_CLASS) return "authentication";
  if (CONNECTION_SQLSTATE_CLASSES.has(sqlClass)) return "connection";
  return "query";
}

/** Pure. The first recognised structured code on `error` or its `cause` chain decides; otherwise `unknown`. */
export function classifyPersistenceFailure(error: unknown): PersistenceFailureCause {
  let current: unknown = error;
  for (let depth = 0; depth <= MAX_CAUSE_DEPTH; depth += 1) {
    const code = codeOf(current);
    const cause = code === undefined ? undefined : classifyCode(code);
    if (cause) return cause;
    if (typeof current !== "object" || current === null) break;
    current = (current as { readonly cause?: unknown }).cause;
  }
  return "unknown";
}
