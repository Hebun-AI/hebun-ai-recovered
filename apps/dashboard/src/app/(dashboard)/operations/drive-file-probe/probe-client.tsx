"use client";

/*
 * TEMPORARY — DRIVE-FILE-FOLDER-PROBE-1. Folder-only chooser + the two probe steps. The access token
 * goes from the server's answer straight into Google's chooser and is never kept in state or shown.
 */
import { useState, useTransition } from "react";
import { loadGooglePickerApi } from "@/components/knowledge-workspace/google-picker.client";
import { Button } from "@/components/ui/button";
import { authorizeDriveFolderProbeSessionAction, runDriveFolderProbeAction } from "./actions";

interface Builder {
  addView(v: unknown): Builder;
  setOAuthToken(t: string): Builder;
  setDeveloperKey(k: string): Builder;
  setAppId(a: string): Builder;
  setTitle(t: string): Builder;
  setCallback(cb: (d: Record<string, unknown>) => void): Builder;
  build(): { setVisible(v: boolean): void };
}
interface FolderView {
  setIncludeFolders(b: boolean): FolderView;
  setSelectFolderEnabled(b: boolean): FolderView;
  setMimeTypes(m: string): FolderView;
}
interface Ns {
  PickerBuilder: new () => Builder;
  DocsView: new (id?: unknown) => FolderView;
  ViewId: Record<string, unknown>;
  Action: Record<string, string>;
  Response: Record<string, string>;
  Document: Record<string, string>;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

export function DriveFolderProbe() {
  const [binding, setBinding] = useState<string | null>(null);
  const [folder, setFolder] = useState<{ id: string; name: string } | null>(null);
  const [startPageToken, setStartPageToken] = useState<string | null>(null);
  const [outsideId, setOutsideId] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const add = (line: string) => setLog((l) => [...l, `${new Date().toISOString()}  ${line}`]);

  async function freshBinding(): Promise<{ accessToken: string; apiKey: string; appId: string; binding: string } | null> {
    const s = await authorizeDriveFolderProbeSessionAction();
    if (s.status !== "authorized") {
      add(`session refused: ${s.status} ${"detail" in s ? s.detail : ""}`);
      return null;
    }
    setBinding(s.binding);
    return s;
  }

  function chooseFolder() {
    start(async () => {
      const s = await freshBinding();
      if (!s) return;
      let picker: Ns;
      try {
        picker = (await loadGooglePickerApi()) as Ns;
      } catch {
        add("Google Picker could not be loaded.");
        return;
      }
      const chosen = await new Promise<{ id: string; name: string; mimeType: string } | null>((resolve) => {
        const view = new picker.DocsView(picker.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes(FOLDER_MIME);
        new picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(s.accessToken)
          .setDeveloperKey(s.apiKey)
          .setAppId(s.appId)
          .setTitle("Choose the probe folder (hebun-drive-file-folder-probe-2026-09-29)")
          .setCallback((d) => {
            const action = d[picker.Response.ACTION];
            if (action === picker.Action.CANCEL) return resolve(null);
            if (action !== picker.Action.PICKED) return;
            const doc = (Array.isArray(d[picker.Response.DOCUMENTS]) ? (d[picker.Response.DOCUMENTS] as Record<string, unknown>[])[0] : null) ?? {};
            const id = doc[picker.Document.ID];
            resolve(typeof id === "string" ? { id, name: String(doc[picker.Document.NAME] ?? ""), mimeType: String(doc[picker.Document.MIME_TYPE] ?? "") } : null);
          })
          .build()
          .setVisible(true);
      });
      if (!chosen) {
        add("No folder chosen.");
        return;
      }
      setFolder({ id: chosen.id, name: chosen.name });
      add(`PICKED ${chosen.name} (${chosen.mimeType}) id=${chosen.id}`);
      const r = await runDriveFolderProbeAction({ step: "baseline", binding: s.binding, folderId: chosen.id });
      add(`BASELINE ${JSON.stringify(r)}`);
      if (r.status === "probed" && r.startPageToken) setStartPageToken(r.startPageToken);
    });
  }

  function runLater() {
    if (!folder || !startPageToken) return;
    start(async () => {
      /* A fresh binding for the SAME connection if the first one expired (30 min); the Google grant is unchanged. */
      let b: string | null = binding;
      const first = await runDriveFolderProbeAction({ step: "later", binding: b ?? "", folderId: folder.id, startPageToken, outsideFileId: outsideId || null });
      if (first.status === "refused" && /binding-expired/.test(first.reason)) {
        add("binding expired — minting a new session for the same connection (no chooser opened)");
        const s = await freshBinding();
        if (!s) return;
        b = s.binding;
        const again = await runDriveFolderProbeAction({ step: "later", binding: b, folderId: folder.id, startPageToken, outsideFileId: outsideId || null });
        add(`LATER ${JSON.stringify(again)}`);
        return;
      }
      add(`LATER ${JSON.stringify(first)}`);
    });
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={chooseFolder} disabled={pending}>
          1 · Choose folder + baseline
        </Button>
        <Button size="sm" onClick={runLater} disabled={pending || !folder || !startPageToken}>
          2 · Re-probe (after adding future-child.txt)
        </Button>
      </div>
      <label className="block text-xs text-fg-secondary">
        Outside-control file id (optional, from its Drive URL — do NOT pick it)
        <input
          className="mt-1 w-full min-w-0 rounded border border-border-subtle bg-surface-1 px-2 py-1 font-mono text-xs"
          value={outsideId}
          onChange={(e) => setOutsideId(e.target.value.trim())}
        />
      </label>
      <pre className="max-h-[60vh] min-w-0 overflow-auto whitespace-pre-wrap break-all rounded border border-border-subtle bg-surface-1 p-2 font-mono text-[11px]">
        {log.join("\n\n") || "No probe run yet."}
      </pre>
    </div>
  );
}
