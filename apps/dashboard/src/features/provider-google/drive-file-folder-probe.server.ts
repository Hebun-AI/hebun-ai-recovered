/*
 * provider-google/drive-file-folder-probe.server.ts — TEMPORARY (DRIVE-FILE-FOLDER-PROBE-1).
 *
 * A bounded provider-contract experiment, NOT product runtime, and removed after the probe. It asks
 * Google one question with real evidence: after a human picks a FOLDER in the Picker under `drive.file`,
 * what can this app see and read inside it — now, and after a file is added later through Drive's own UI?
 *
 * WHAT IT DOES, AND ONLY THIS — every call a GET, through the ONE connection the Picker binding names:
 *
 *   baseline   files.get(folder) · files.list('<folder>' in parents) · alt=media of each small text
 *              child (≤ 1 KiB, at most 5) · changes.getStartPageToken
 *   later      files.list again · alt=media again · changes.list from the caller's start token ·
 *              optional files.get + alt=media of ONE outside file id (the negative control)
 *
 * It writes nothing: no row, no Media, no Knowledge, no token or page-token persisted. The connection is
 * resolved from the signed Picker binding against current Integration authority — never "the first"
 * connection. The only credential effect possible is the existing `withGoogleAccessToken` refresh of an
 * expired access token, which is the released credential lifecycle.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { GOOGLE_DRIVE_FILES_ENDPOINT } from "./contracts";
import { withGoogleAccessToken } from "./google-authorized-call.server";
import { resolveBoundDriveFileConnection } from "./picker-connection-binding.server";

const DRIVE_CHANGES_ENDPOINT = "https://www.googleapis.com/drive/v3/changes";
const ID = /^[A-Za-z0-9_-]{1,256}$/;
const PAGE_TOKEN = /^[A-Za-z0-9_-]{1,512}$/;
const MAX_TEXT_BYTES = 1024;
const MAX_READS = 5;
const MAX_CHANGE_PAGES = 5;
const TIMEOUT_MS = 10_000;

export interface ProbeCall {
  readonly call: string;
  readonly target: string;
  readonly httpStatus: number | null;
  readonly outcome: "ok" | "refused" | "not-attempted" | "transport-failed";
  readonly detail?: string;
}

export interface ProbeFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: string | null;
}

export interface ProbeRead {
  readonly id: string;
  readonly httpStatus: number | null;
  readonly readable: boolean;
  readonly byteLength: number | null;
  /** The first ≤ 64 characters of a SYNTHETIC text file — evidence the bytes were really read. */
  readonly textPrefix: string | null;
}

export interface ProbeChange {
  readonly fileId: string | null;
  readonly removed: boolean;
  readonly changeType: string | null;
  readonly fileName: string | null;
  readonly parents: readonly string[] | null;
}

export type DriveFolderProbeResult =
  | { readonly status: "refused"; readonly reason: string }
  | {
      readonly status: "probed";
      readonly step: "baseline" | "later";
      readonly integrationId: string;
      readonly at: string;
      readonly calls: readonly ProbeCall[];
      readonly folder: { readonly id: string; readonly name: string; readonly mimeType: string } | null;
      readonly children: readonly ProbeFile[] | null;
      readonly reads: readonly ProbeRead[];
      readonly startPageToken: string | null;
      readonly changes: readonly ProbeChange[] | null;
      readonly newStartPageToken: string | null;
      readonly outside: { readonly meta: ProbeFile | null; readonly read: ProbeRead | null } | null;
    };

export type DriveFolderProbeInput =
  | { readonly step: "baseline"; readonly binding: string; readonly folderId: string }
  | {
      readonly step: "later";
      readonly binding: string;
      readonly folderId: string;
      readonly startPageToken: string;
      readonly outsideFileId?: string | null;
    };

type Fetcher = typeof fetch;

async function getJson(doFetch: Fetcher, url: URL, token: string): Promise<{ status: number | null; body: Record<string, unknown> | null }> {
  try {
    const res = await doFetch(url.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    let body: Record<string, unknown> | null = null;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      body = null;
    }
    return { status: res.status, body };
  } catch {
    return { status: null, body: null };
  }
}

function errorReason(body: Record<string, unknown> | null): string | undefined {
  const err = body?.error as { errors?: { reason?: unknown }[]; status?: unknown } | undefined;
  const reason = err?.errors?.[0]?.reason ?? err?.status;
  return typeof reason === "string" ? reason.slice(0, 80) : undefined;
}

async function readText(doFetch: Fetcher, id: string, token: string): Promise<ProbeRead> {
  const url = new URL(`${GOOGLE_DRIVE_FILES_ENDPOINT}/${encodeURIComponent(id)}`);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "false");
  try {
    const res = await doFetch(url.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${token}`, range: `bytes=0-${MAX_TEXT_BYTES - 1}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      return { id, httpStatus: res.status, readable: false, byteLength: null, textPrefix: null };
    }
    const bytes = new Uint8Array(await res.arrayBuffer()).subarray(0, MAX_TEXT_BYTES);
    return {
      id,
      httpStatus: res.status,
      readable: true,
      byteLength: bytes.byteLength,
      textPrefix: new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 64),
    };
  } catch {
    return { id, httpStatus: null, readable: false, byteLength: null, textPrefix: null };
  }
}

function asFile(v: unknown): ProbeFile | null {
  const f = v as Record<string, unknown> | null;
  if (!f || typeof f.id !== "string") return null;
  return {
    id: f.id,
    name: typeof f.name === "string" ? f.name : "",
    mimeType: typeof f.mimeType === "string" ? f.mimeType : "",
    size: typeof f.size === "string" ? f.size : null,
  };
}

export async function runDriveFolderProbe(
  tenant: TenantContext | null,
  input: DriveFolderProbeInput | null,
  deps: { readonly fetchImpl?: Fetcher } = {},
): Promise<DriveFolderProbeResult> {
  if (typeof window !== "undefined") throw new Error("The Drive folder probe is server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "refused", reason: "unauthenticated" };
  if (!input || (input.step !== "baseline" && input.step !== "later") || typeof input.binding !== "string" || !ID.test(input.folderId ?? "")) {
    return { status: "refused", reason: "invalid-input" };
  }
  if (input.step === "later") {
    if (!PAGE_TOKEN.test(input.startPageToken ?? "")) return { status: "refused", reason: "invalid-input" };
    if (input.outsideFileId != null && input.outsideFileId !== "" && !ID.test(input.outsideFileId)) return { status: "refused", reason: "invalid-input" };
  }

  /* The ONE connection the Picker ceremony was bound to — or nothing. */
  const bound = await resolveBoundDriveFileConnection(tenant, input.binding);
  if (bound.status !== "bound") return { status: "refused", reason: bound.reason };

  const doFetch = deps.fetchImpl ?? fetch;
  const folderId = input.folderId;
  const calls: ProbeCall[] = [];
  const record = (call: string, target: string, status: number | null, body: Record<string, unknown> | null): boolean => {
    const ok = status !== null && status >= 200 && status < 300;
    calls.push({ call, target, httpStatus: status, outcome: status === null ? "transport-failed" : ok ? "ok" : "refused", ...(ok ? {} : { detail: errorReason(body) }) });
    return ok;
  };

  const outcome = await withGoogleAccessToken(tenant, bound.integrationId, async (token) => {
    let folder: { id: string; name: string; mimeType: string } | null = null;
    let children: ProbeFile[] | null = null;
    const reads: ProbeRead[] = [];
    let startPageToken: string | null = null;
    let changes: ProbeChange[] | null = null;
    let newStartPageToken: string | null = null;
    let outside: { meta: ProbeFile | null; read: ProbeRead | null } | null = null;

    /* E1 — the folder itself. A 401 here lets the released runner refresh once. */
    const metaUrl = new URL(`${GOOGLE_DRIVE_FILES_ENDPOINT}/${encodeURIComponent(folderId)}`);
    metaUrl.searchParams.set("fields", "id,name,mimeType");
    metaUrl.searchParams.set("supportsAllDrives", "false");
    const meta = await getJson(doFetch, metaUrl, token);
    if (meta.status === 401) return { ok: false as const, failure: "auth" as const, reason: "google-refused-401" };
    if (record("files.get", "folder", meta.status, meta.body)) {
      const f = asFile(meta.body);
      folder = f ? { id: f.id, name: f.name, mimeType: f.mimeType } : null;
    }

    /* E2 / F1 — enumerate the folder's children as this authorization sees them. */
    const listUrl = new URL(GOOGLE_DRIVE_FILES_ENDPOINT);
    listUrl.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    listUrl.searchParams.set("fields", "files(id,name,mimeType,size)");
    listUrl.searchParams.set("pageSize", "100");
    listUrl.searchParams.set("spaces", "drive");
    listUrl.searchParams.set("supportsAllDrives", "false");
    const list = await getJson(doFetch, listUrl, token);
    if (record("files.list", "'<folder>' in parents", list.status, list.body)) {
      const files = Array.isArray(list.body?.files) ? (list.body!.files as unknown[]) : [];
      children = files.map(asFile).filter((f): f is ProbeFile => f !== null);
    }

    /* E3 / F2 — bounded content read of small text children only. */
    for (const child of (children ?? []).filter((c) => c.mimeType === "text/plain" && (c.size === null || Number(c.size) <= MAX_TEXT_BYTES)).slice(0, MAX_READS)) {
      const r = await readText(doFetch, child.id, token);
      reads.push(r);
      calls.push({ call: "files.get media", target: child.name, httpStatus: r.httpStatus, outcome: r.readable ? "ok" : r.httpStatus === null ? "transport-failed" : "refused" });
    }

    if (input.step === "baseline") {
      const tokUrl = new URL(`${DRIVE_CHANGES_ENDPOINT}/startPageToken`);
      tokUrl.searchParams.set("supportsAllDrives", "false");
      const tok = await getJson(doFetch, tokUrl, token);
      if (record("changes.getStartPageToken", "account", tok.status, tok.body)) {
        startPageToken = typeof tok.body?.startPageToken === "string" ? tok.body.startPageToken : null;
      }
    } else {
      /* Changes since the caller's baseline token, as THIS authorization sees them. */
      changes = [];
      let pageToken: string | null = input.startPageToken;
      for (let page = 0; pageToken && page < MAX_CHANGE_PAGES; page++) {
        const chUrl = new URL(DRIVE_CHANGES_ENDPOINT);
        chUrl.searchParams.set("pageToken", pageToken);
        chUrl.searchParams.set("pageSize", "100");
        chUrl.searchParams.set("includeRemoved", "true");
        chUrl.searchParams.set("spaces", "drive");
        chUrl.searchParams.set("supportsAllDrives", "false");
        chUrl.searchParams.set("fields", "nextPageToken,newStartPageToken,changes(fileId,removed,changeType,file(id,name,parents))");
        const ch = await getJson(doFetch, chUrl, token);
        if (!record("changes.list", `page ${page + 1}`, ch.status, ch.body)) break;
        for (const c of Array.isArray(ch.body?.changes) ? (ch.body!.changes as Record<string, unknown>[]) : []) {
          const file = c.file as Record<string, unknown> | undefined;
          changes.push({
            fileId: typeof c.fileId === "string" ? c.fileId : null,
            removed: c.removed === true,
            changeType: typeof c.changeType === "string" ? c.changeType : null,
            fileName: typeof file?.name === "string" ? file.name : null,
            parents: Array.isArray(file?.parents) ? (file!.parents as string[]) : null,
          });
        }
        newStartPageToken = typeof ch.body?.newStartPageToken === "string" ? ch.body.newStartPageToken : newStartPageToken;
        pageToken = typeof ch.body?.nextPageToken === "string" ? ch.body.nextPageToken : null;
      }
      /* A file id the changes feed exposed but the folder listing did not: can it be read? */
      const listed = new Set((children ?? []).map((c) => c.id));
      for (const c of changes.filter((x) => x.fileId && !x.removed && !listed.has(x.fileId)).slice(0, MAX_READS)) {
        const r = await readText(doFetch, c.fileId!, token);
        reads.push(r);
        calls.push({ call: "files.get media (from changes)", target: c.fileName ?? c.fileId!, httpStatus: r.httpStatus, outcome: r.readable ? "ok" : r.httpStatus === null ? "transport-failed" : "refused" });
      }

      /* Negative control: ONE file id outside the folder, never picked. */
      if (input.outsideFileId) {
        const oUrl = new URL(`${GOOGLE_DRIVE_FILES_ENDPOINT}/${encodeURIComponent(input.outsideFileId)}`);
        oUrl.searchParams.set("fields", "id,name,mimeType,size");
        oUrl.searchParams.set("supportsAllDrives", "false");
        const o = await getJson(doFetch, oUrl, token);
        const metaOk = record("files.get", "outside-control", o.status, o.body);
        const r = await readText(doFetch, input.outsideFileId, token);
        calls.push({ call: "files.get media", target: "outside-control", httpStatus: r.httpStatus, outcome: r.readable ? "ok" : r.httpStatus === null ? "transport-failed" : "refused" });
        outside = { meta: metaOk ? asFile(o.body) : null, read: r };
      }
    }

    return { ok: true as const, value: { folder, children, reads, startPageToken, changes, newStartPageToken, outside } };
  });

  if (!outcome.ok) return { status: "refused", reason: `${outcome.failure}:${outcome.reason}` };
  return {
    status: "probed",
    step: input.step,
    integrationId: bound.integrationId,
    at: new Date().toISOString(),
    calls,
    ...outcome.value,
  };
}
