/*
 * scripts/lib/ceremony-control-plane.ts — the control-plane handle a ceremony may open AFTER its
 * target has been proven. Operator tooling only.
 *
 * WHY THIS EXISTS. Some ceremonies write through released `src/` authorities (their writers resolve
 * a Drizzle handle), not through a raw `pg` client. Those writers default to the process-wide
 * control-plane singleton, which — correctly — refuses a non-local database unless
 * `HEBUN_CONTROL_PLANE_ALLOW_REMOTE` is exactly "true" (`src/db/client.server.ts`). The deployed runtime
 * sets that flag; an operator terminal does not, and must not have to set it globally.
 *
 * WHAT IT DOES. It takes a `PreflightOk` — the verdict `preflight` returns only after
 * `verifyProductionTarget` bound the live cluster to the pinned `system_identifier` + database and
 * found the ledger current — and opens ONE handle for that exact URL. In a PRODUCTION posture the
 * handle's own environment carries the remote flag; `process.env` is never modified, so no other
 * handle, singleton or import in the process gains remote reach. In a LOCAL posture the environment
 * is passed through unchanged: the target is loopback and the guard needs nothing.
 *
 * WHAT IT DOES NOT DO. It verifies nothing itself — `ceremony-preflight.ts` and
 * `production-possession.ts` remain the only production-target authority. It does not relax the
 * remote guard: `createControlPlaneDb` still runs `assertControlPlaneTargetAllowed`, including the
 * pulled-snapshot refusal that is checked BEFORE the flag. Without a `ready` verdict there is no
 * code path to a remote handle here.
 */
import { CONTROL_PLANE_ALLOW_REMOTE_ENV, createControlPlaneDb, type ControlPlaneEnvironment } from "../../src/db/client.server";
import type { PreflightOk } from "./ceremony-preflight";

/** The environment one ceremony handle is built with. Pure; `base` is never mutated. */
export function ceremonyControlPlaneEnv(
  ready: PreflightOk,
  base: ControlPlaneEnvironment = process.env,
): ControlPlaneEnvironment {
  if (ready.status !== "ready") throw new Error("a ceremony control plane requires a ready preflight verdict");
  if (ready.posture.mode !== "production") return base;
  return { ...base, [CONTROL_PLANE_ALLOW_REMOTE_ENV]: "true" };
}

/** Open the one handle this ceremony writes through, for the URL its preflight proved. */
export function openCeremonyControlPlane(ready: PreflightOk, databaseUrl: string) {
  return createControlPlaneDb(databaseUrl, ceremonyControlPlaneEnv(ready));
}
