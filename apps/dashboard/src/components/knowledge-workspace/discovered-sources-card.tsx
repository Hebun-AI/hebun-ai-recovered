import type { DriveSourceDiscovery } from "@/features/provider-google/discover-drive-sources.server";

/*
 * Discovered sources — WHAT EXISTS IN A CONNECTED PROVIDER, AND NOTHING MORE.
 *
 * PRESENTATIONAL ONLY. It receives an already-resolved provider-derived result as a prop and
 * resolves nothing itself: no tenant, no connection, no capability, no credential, no provider.
 * The type import above disappears at compile time and creates no execution edge.
 *
 * Every sentence is written so a reader cannot come away believing Hebun imported, downloaded,
 * opened, synchronized or owns any of these documents. There is no Import, Sync, Add to Knowledge
 * or Summarize control, because no admission flow for a provider document exists yet — and a
 * control that refused would be a promise Hebun has not kept.
 */
function formatSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/** Provider type strings are not human words. Only types the granted scope can report. */
function describeType(mimeType: string): string {
  const known: Readonly<Record<string, string>> = {
    "application/vnd.google-apps.document": "Google Doc",
    "application/vnd.google-apps.spreadsheet": "Google Sheet",
    "application/vnd.google-apps.presentation": "Google Slides",
    "application/vnd.google-apps.folder": "Folder",
    "application/pdf": "PDF",
    "text/plain": "Text",
    "text/markdown": "Markdown",
  };
  return known[mimeType] ?? mimeType;
}

export function DiscoveredSourcesCard({
  discovery,
}: {
  readonly discovery: DriveSourceDiscovery;
}) {
  if (discovery.status === "unauthenticated") {
    return <p className="text-sm">Sign in to see what this organization has connected.</p>;
  }

  if (discovery.status === "unavailable") {
    return (
      <div className="space-y-2 text-sm">
        <p>{discovery.reason}</p>
        <p className="text-muted">
          Nothing was read from any provider. This is not a statement that no documents exist.
        </p>
      </div>
    );
  }

  if (discovery.status === "provider-failed") {
    return (
      <div className="space-y-2 text-sm">
        <p>Google Drive did not answer, so nothing could be discovered right now.</p>
        <p className="text-muted">
          The connection and the access granted to it are unaffected, and no reconnection is needed.
          This is not a statement that no documents exist.
        </p>
      </div>
    );
  }

  if (discovery.status === "empty") {
    return (
      <div className="space-y-2 text-sm">
        <p>Google Drive answered, and this organization&rsquo;s Drive holds no documents.</p>
        <p className="text-muted">
          A successful read that found nothing — not a failure, and not missing access.
        </p>
      </div>
    );
  }

  const { candidates } = discovery;

  return (
    <div className="space-y-3 text-sm">
      <p>
        {candidates.length} document{candidates.length === 1 ? "" : "s"} discovered in the connected
        Google Drive. <strong>They have not been imported into Hebun Knowledge.</strong> Hebun read
        their names and properties only — it did not open, download or store any of them.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--line)]">
              <th className="py-2 pr-4 font-medium">Document</th>
              <th className="py-2 pr-4 font-medium">Type</th>
              <th className="py-2 pr-4 font-medium">Modified</th>
              <th className="py-2 font-medium">Size</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => (
              <tr key={candidate.externalId} className="border-b border-[var(--line)]/50">
                <td className="py-2 pr-4">
                  {candidate.name}
                  {candidate.trashed ? (
                    <span className="ml-2 text-muted">(in Drive trash)</span>
                  ) : null}
                </td>
                <td className="py-2 pr-4">{describeType(candidate.mimeType)}</td>
                <td className="py-2 pr-4">
                  {candidate.modifiedAt ? candidate.modifiedAt.slice(0, 10) : "—"}
                </td>
                <td className="py-2">{formatSize(candidate.sizeBytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-muted">
        Read live from Google each time this page loads. Hebun stores none of it.
      </p>
    </div>
  );
}
