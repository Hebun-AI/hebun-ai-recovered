/*
 * Runs the real VPS media store (`infra/media-store-vps/hebun_media_store.py`) as a local child
 * process on an ephemeral loopback port, over a temporary root, with throwaway secrets.
 *
 * Test-only. No production secret, host or byte is involved. Requires `python3` on PATH; a missing
 * interpreter FAILS the suite rather than skipping it, so a green run always exercised the store.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

export const VPS_STORE_SCRIPT = path.resolve(process.cwd(), "../../infra/media-store-vps/hebun_media_store.py");

export interface LocalVpsStore {
  readonly origin: string;
  readonly root: string;
  readonly writeSecret: string;
  readonly readSecret: string;
  stop(): Promise<void>;
  restart(): Promise<void>;
  dispose(): Promise<void>;
}

async function launch(env: Record<string, string>): Promise<{ child: ChildProcess; port: number }> {
  const child: ChildProcess = spawn("python3", [VPS_STORE_SCRIPT], {
    env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv,
    stdio: ["ignore", "ignore", "pipe"],
  });
  const port = await new Promise<number>((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => reject(new Error("media store did not start")), 10_000);
    child.once("error", reject);
    child.once("exit", (code) => reject(new Error(`media store exited during startup (${code}): ${buffer}`)));
    child.stderr!.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const match = /listening on [^:]+:(\d+)/.exec(buffer);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
  });
  child.removeAllListeners("exit");
  return { child, port };
}

async function terminate(child: ChildProcess | null): Promise<void> {
  /* A signalled child has exitCode null and signalCode set: waiting for another `exit` would leave the
     event loop empty, and Node would end the whole test with status 0 — a silent false pass. */
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
  });
}

export async function startLocalVpsStore(): Promise<LocalVpsStore> {
  const root = mkdtempSync(path.join(tmpdir(), "hebun-vps-store-"));
  const writeSecret = randomBytes(32).toString("hex");
  const readSecret = randomBytes(32).toString("hex");
  const env = {
    HEBUN_MEDIA_STORE_ROOT: root,
    HEBUN_MEDIA_STORE_WRITE_SECRET: writeSecret,
    HEBUN_MEDIA_STORE_READ_SECRET: readSecret,
    HEBUN_MEDIA_STORE_MIN_FREE_BYTES: "0",
  };
  const launched = await launch({ ...env, HEBUN_MEDIA_STORE_PORT: "0" });
  let child = launched.child;
  const port = launched.port;
  const origin = `http://127.0.0.1:${port}`;
  const handle: LocalVpsStore = {
    origin,
    root,
    writeSecret,
    readSecret,
    async stop() {
      await terminate(child);
    },
    async restart() {
      await terminate(child);
      /* Same port, same root, same secrets: a restart, not a new store. */
      ({ child } = await launch({ ...env, HEBUN_MEDIA_STORE_PORT: String(port) }));
    },
    async dispose() {
      await terminate(child);
      rmSync(root, { recursive: true, force: true });
    },
  };
  return handle;
}
