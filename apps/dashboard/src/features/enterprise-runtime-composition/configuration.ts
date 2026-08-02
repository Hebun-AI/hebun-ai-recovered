export type EnterpriseProjectionProviderMode = "mock";

export function resolveEnterpriseProjectionProviderMode(mode?: unknown): EnterpriseProjectionProviderMode {
  if (mode === undefined) return "mock";
  if (mode === "mock") return mode;

  throw new Error(`Unsupported enterprise projection provider mode: ${String(mode)}`);
}
