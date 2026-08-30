/*
 * knowledge-workspace/google-picker.client.ts — OPEN GOOGLE'S OWN FILE CHOOSER, ONCE.
 *
 * ── WHAT IT IS ───────────────────────────────────────────────────────────────
 *
 * A thin wrapper around Google's Picker JavaScript API. It loads Google's script, opens the chooser
 * with a token the SERVER authorized, and resolves with the ONE document the human selected — or
 * with `null`, which means they closed it.
 *
 *     SELECTION != ADMISSION
 *
 * It admits nothing, reads no file content, calls no Hebun action, and returns no Knowledge. What
 * it produces is a provider file IDENTITY — an id, a name and a MIME type — and the server decides
 * everything that happens next, re-resolving every authority for itself.
 *
 * ── WHY THE PICKER AT ALL ────────────────────────────────────────────────────
 *
 * Because it is what makes `drive.file` usable. Google grants that scope per-file, to files "that
 * the user shares with an app while using the Google Picker API", so the chooser is not a nicer UI
 * over a listing Hebun already had — it IS the permission mechanism. Hebun's own Drive-wide listing
 * needed a restricted scope; this needs none.
 *
 * ── WHAT IT DELIBERATELY DOES NOT ENABLE ─────────────────────────────────────
 *
 * No multi-select feature, no folder view, no upload view, no shared-drive view. One document per
 * call, and the view is restricted to the MIME types Hebun can actually admit — so a spreadsheet is
 * not offered and then refused, it is simply not offered.
 *
 * The token lives in this module's arguments and in Google's Picker instance for the length of one
 * chooser. It is never written to storage, never put in a URL, and never returned to the caller.
 *
 * Browser-only.
 */

/** One document the human chose. A provider identity, and nothing that carries Hebun authority. */
export interface PickedGoogleDocument {
  readonly fileId: string;
  readonly name: string;
  readonly mimeType: string;
}

export type PickerOutcome =
  | { readonly status: "picked"; readonly document: PickedGoogleDocument }
  /** The human closed the chooser. NOT a failure, and never reported as one. */
  | { readonly status: "cancelled" }
  /** Google's own script could not be loaded or initialized. Nothing was chosen. */
  | { readonly status: "unavailable"; readonly detail: string };

interface PickerBuilderLike {
  addView(view: unknown): PickerBuilderLike;
  setOAuthToken(token: string): PickerBuilderLike;
  setDeveloperKey(key: string): PickerBuilderLike;
  setAppId(appId: string): PickerBuilderLike;
  setCallback(callback: (data: Record<string, unknown>) => void): PickerBuilderLike;
  setTitle(title: string): PickerBuilderLike;
  build(): { setVisible(visible: boolean): void };
}

interface DocsViewLike {
  setMimeTypes(mimeTypes: string): DocsViewLike;
  setIncludeFolders(include: boolean): DocsViewLike;
  setSelectFolderEnabled(enabled: boolean): DocsViewLike;
}

interface GooglePickerNamespace {
  PickerBuilder: new () => PickerBuilderLike;
  DocsView: new (viewId?: unknown) => DocsViewLike;
  ViewId: Record<string, unknown>;
  Action: Record<string, string>;
  Response: Record<string, string>;
  Document: Record<string, string>;
}

interface GapiLike {
  load(name: string, callback: () => void): void;
}

const GOOGLE_API_SCRIPT = "https://apis.google.com/js/api.js";

function windowWith<T>(key: string): T | undefined {
  return (globalThis as unknown as Record<string, T | undefined>)[key];
}

/** Load Google's API script once. Repeated calls reuse the same element rather than adding another. */
function loadGoogleApiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (windowWith<GapiLike>("gapi")) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_API_SCRIPT}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("google-api-script-failed")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = GOOGLE_API_SCRIPT;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("google-api-script-failed")), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

function loadPickerModule(): Promise<GooglePickerNamespace> {
  return new Promise((resolve, reject) => {
    const gapi = windowWith<GapiLike>("gapi");
    if (!gapi) {
      reject(new Error("google-api-unavailable"));
      return;
    }
    gapi.load("picker", () => {
      const google = windowWith<{ picker?: GooglePickerNamespace }>("google");
      if (!google?.picker) {
        reject(new Error("google-picker-unavailable"));
        return;
      }
      resolve(google.picker);
    });
  });
}

/**
 * Open the chooser and resolve with the single document the human selected.
 *
 * `mimeTypes` restricts what the chooser will show at all. It is supplied by the caller from
 * Hebun's own closed readable-type map, so the chooser cannot offer a format the server would then
 * refuse — the two lists are the same list.
 */
export async function openGooglePicker(session: {
  readonly accessToken: string;
  readonly apiKey: string;
  readonly appId: string;
  readonly mimeTypes: readonly string[];
}): Promise<PickerOutcome> {
  let picker: GooglePickerNamespace;
  try {
    await loadGoogleApiScript();
    picker = await loadPickerModule();
  } catch (error) {
    return {
      status: "unavailable",
      detail:
        error instanceof Error && error.message === "google-api-script-failed"
          ? "Google's document chooser could not be loaded in this browser. Nothing was chosen."
          : "Google's document chooser is not available right now. Nothing was chosen.",
    };
  }

  return new Promise<PickerOutcome>((resolve) => {
    /*
     * ONE VIEW, FILTERED, AND NO FOLDERS. `setSelectFolderEnabled(false)` and
     * `setIncludeFolders(false)` are stated explicitly rather than left to defaults, because a
     * folder is the one selection this product has decided it does not accept.
     */
    const view = new picker.DocsView(picker.ViewId.DOCS)
      .setMimeTypes(session.mimeTypes.join(","))
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);

    /*
     * NO `MULTISELECT_ENABLED` FEATURE IS ENABLED, which is how "exactly one document" is enforced
     * at the chooser itself rather than by trimming a list afterwards.
     */
    const built = new picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(session.accessToken)
      .setDeveloperKey(session.apiKey)
      .setAppId(session.appId)
      .setTitle("Choose one document to admit into Hebun Knowledge")
      .setCallback((data) => {
        const action = data[picker.Response.ACTION];
        if (action === picker.Action.CANCEL) {
          resolve({ status: "cancelled" });
          return;
        }
        if (action !== picker.Action.PICKED) return;

        const documents = data[picker.Response.DOCUMENTS];
        const first = Array.isArray(documents) ? documents[0] : undefined;
        if (!first || typeof first !== "object") {
          resolve({ status: "cancelled" });
          return;
        }
        const chosen = first as Record<string, unknown>;
        const fileId = chosen[picker.Document.ID];
        const name = chosen[picker.Document.NAME];
        const mimeType = chosen[picker.Document.MIME_TYPE];
        if (typeof fileId !== "string" || typeof mimeType !== "string") {
          resolve({
            status: "unavailable",
            detail: "Google returned a selection Hebun could not read. Nothing was chosen.",
          });
          return;
        }
        resolve({
          status: "picked",
          document: { fileId, name: typeof name === "string" ? name : "", mimeType },
        });
      })
      .build();

    built.setVisible(true);
  });
}
