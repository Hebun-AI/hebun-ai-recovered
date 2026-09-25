/*
 * media-assets/drive-file-ref.ts — a human's Drive reference → Drive's opaque file id (MEDIA-SUPPLIED).
 *
 * A person copies either the bare id or a share link. This accepts exactly those two shapes and
 * returns the id; everything else is null. It does not fetch, follow or trust the link — the id is
 * the only thing kept, and the Media authority re-validates it before any read.
 *
 * Pure.
 */
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,256}$/;

export function driveFileIdFrom(reference: string): string | null {
  const text = reference.trim();
  if (DRIVE_FILE_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || (url.hostname !== "drive.google.com" && url.hostname !== "docs.google.com")) {
    return null;
  }
  const path = /^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/.exec(url.pathname);
  const candidate = path?.[1] ?? url.searchParams.get("id");
  return candidate && DRIVE_FILE_ID.test(candidate) ? candidate : null;
}
