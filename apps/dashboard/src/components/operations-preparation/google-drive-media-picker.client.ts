/*
 * operations-preparation/google-drive-media-picker.client.ts — GOOGLE'S CHOOSER, SEVERAL FILES, ONCE
 * (CONTENT-INTAKE-1).
 *
 * The Media sibling of `knowledge-workspace/google-picker.client.ts`. That chooser stays exactly one
 * document (Knowledge admits one document per decision); this one lets the human choose up to a bound
 * in ONE ceremony, because supplying five photographs for one draft should not take five ceremonies.
 *
 *     SELECTION != ADMISSION
 *
 * It admits nothing and reads no file content. It resolves with the provider IDENTITIES Google
 * returned — id, name, MIME type — and the server decides everything that follows, re-reading each
 * file's metadata and bytes for itself. The MIME type here is Google's claim, kept only for the
 * human's summary; it routes nothing (the kind is fixed by which door the human opened).
 *
 * Provider contract (Google Picker API reference): `Feature.MULTISELECT_ENABLED` — "Allow user to
 * choose more than one item"; `PickerBuilder.setMaxItems` — "Sets the maximum number of items a user
 * can pick" (no documented default or ceiling); the response's `docs` — "An array of DocumentObjects
 * selected by the user", each with its own `id`. `drive.file` is granted per chosen file.
 *
 * `maxItems` is the server's batch bound, passed in by the door. It is a convenience here: the server
 * enforces the same number itself, and a chooser that returned more would be refused, not trimmed.
 *
 * No folder view, no folder selection, no upload view, no shared-drive view. The token lives in the
 * arguments and in Google's instance for one chooser; it is never stored or returned.
 *
 * Browser-only.
 */
import { loadGooglePickerApi, type PickedGoogleDocument } from "@/components/knowledge-workspace/google-picker.client";

export type MediaPickerOutcome =
  | { readonly status: "picked"; readonly documents: readonly PickedGoogleDocument[] }
  /** The human closed the chooser. NOT a failure. */
  | { readonly status: "cancelled" }
  | { readonly status: "unavailable"; readonly detail: string };

interface BuilderLike {
  addView(view: unknown): BuilderLike;
  enableFeature(feature: unknown): BuilderLike;
  setMaxItems(max: number): BuilderLike;
  setOAuthToken(token: string): BuilderLike;
  setDeveloperKey(key: string): BuilderLike;
  setAppId(appId: string): BuilderLike;
  setCallback(callback: (data: Record<string, unknown>) => void): BuilderLike;
  setTitle(title: string): BuilderLike;
  build(): { setVisible(visible: boolean): void };
}

interface DocsViewLike {
  setMimeTypes(mimeTypes: string): DocsViewLike;
  setIncludeFolders(include: boolean): DocsViewLike;
  setSelectFolderEnabled(enabled: boolean): DocsViewLike;
}

interface PickerNamespace {
  PickerBuilder: new () => BuilderLike;
  DocsView: new (viewId?: unknown) => DocsViewLike;
  ViewId: Record<string, unknown>;
  Feature: Record<string, unknown>;
  Action: Record<string, string>;
  Response: Record<string, string>;
  Document: Record<string, string>;
}

export async function openGoogleDriveMediaPicker(session: {
  readonly accessToken: string;
  readonly apiKey: string;
  readonly appId: string;
  readonly mimeTypes: readonly string[];
  readonly maxItems: number;
  readonly title: string;
}): Promise<MediaPickerOutcome> {
  let picker: PickerNamespace;
  try {
    picker = (await loadGooglePickerApi()) as PickerNamespace;
  } catch (error) {
    return {
      status: "unavailable",
      detail:
        error instanceof Error && error.message === "google-api-script-failed"
          ? "Google's file chooser could not be loaded in this browser. Nothing was chosen."
          : "Google's file chooser is not available right now. Nothing was chosen.",
    };
  }

  return new Promise<MediaPickerOutcome>((resolve) => {
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setMimeTypes(session.mimeTypes.join(","))
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);

    const built = new picker.PickerBuilder()
      .addView(view)
      .enableFeature(picker.Feature.MULTISELECT_ENABLED)
      .setMaxItems(session.maxItems)
      .setOAuthToken(session.accessToken)
      .setDeveloperKey(session.apiKey)
      .setAppId(session.appId)
      .setTitle(session.title)
      .setCallback((data) => {
        const action = data[picker.Response.ACTION];
        if (action === picker.Action.CANCEL) {
          resolve({ status: "cancelled" });
          return;
        }
        if (action !== picker.Action.PICKED) return;

        const docs = data[picker.Response.DOCUMENTS];
        if (!Array.isArray(docs) || docs.length === 0) {
          resolve({ status: "cancelled" });
          return;
        }
        const documents: PickedGoogleDocument[] = [];
        for (const doc of docs) {
          const d = (doc ?? {}) as Record<string, unknown>;
          const fileId = d[picker.Document.ID];
          const mimeType = d[picker.Document.MIME_TYPE];
          const name = d[picker.Document.NAME];
          /* One unreadable entry makes the whole selection unreadable: nothing is silently dropped. */
          if (typeof fileId !== "string" || typeof mimeType !== "string") {
            resolve({ status: "unavailable", detail: "Google returned a selection Hebun could not read. Nothing was chosen." });
            return;
          }
          documents.push({ fileId, mimeType, name: typeof name === "string" ? name : "" });
        }
        resolve({ status: "picked", documents });
      })
      .build();

    built.setVisible(true);
  });
}
