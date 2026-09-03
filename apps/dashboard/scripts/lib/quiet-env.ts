/* scripts/lib/quiet-env.ts — load named variables from an env file into process.env WITHOUT a shell.
 * Never prints a value. Strips one layer of matching quotes. Later files override earlier ones. */
import { readFileSync } from "node:fs";
export function loadQuietEnv(files: readonly string[], names: readonly string[]): void {
  for (const file of files) {
    let text: string;
    try { text = readFileSync(file, "utf8"); } catch { continue; }
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!names.includes(key)) continue;
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}
