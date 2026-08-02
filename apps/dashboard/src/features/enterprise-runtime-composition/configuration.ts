export type EnterpriseRepositoryMode = "in-memory" | "postgresql";

export function resolveEnterpriseRepositoryMode(mode?: unknown): EnterpriseRepositoryMode {
  if (mode === undefined) return "in-memory";
  if (mode === "in-memory" || mode === "postgresql") return mode;

  throw new Error(`Unsupported enterprise repository mode: ${String(mode)}`);
}
