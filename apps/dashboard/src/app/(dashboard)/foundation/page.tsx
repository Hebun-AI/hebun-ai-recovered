import {
  getAuthEnvironment,
  resolveRequestAuthentication,
} from "@/features/auth-runtime/request-session.server";
import {
  isDurableRegistryConfigured,
  type DurableRegistryRecord,
} from "@/features/tenant-registry/durable-registry-repository.server";
import { listTenantRegistries } from "@/features/tenant-registry/tenant-registry-service.server";
import { logoutAction } from "@/app/login/actions";
import { createFoundationRegistryAction } from "./actions";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

export default async function FoundationPage() {
  const env = getAuthEnvironment();

  if (env.status !== "configured") {
    return (
      <section className="flex flex-col gap-3 p-8">
        <h1 className="text-xl font-semibold">Durable Foundations (R1)</h1>
        <p className="text-sm text-neutral-500">
          Authentication is not configured in this environment, so no tenant
          identity can be resolved and durable persistence status cannot be
          proven. This surface is honest about the closed state.
        </p>
      </section>
    );
  }

  const result = await resolveRequestAuthentication(env);
  if (result.status !== "authorized") {
    return (
      <section className="flex flex-col gap-3 p-8">
        <h1 className="text-xl font-semibold">Durable Foundations (R1)</h1>
        <p className="text-sm text-neutral-500">Sign-in required.</p>
      </section>
    );
  }

  const ctx = result.tenantContext;
  const durable = isDurableRegistryConfigured();
  let registries: DurableRegistryRecord[] = [];
  let durableError: string | undefined;
  if (durable) {
    try {
      registries = await listTenantRegistries(ctx);
    } catch {
      durableError = "Durable read failed.";
    }
  }

  return (
    <section className="flex flex-col gap-8 p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Durable Foundations (R1)</h1>
          <p className="text-sm text-neutral-500">
            Authenticated request → server-resolved tenant → tenant-scoped durable
            registry persistence. Nothing here is memory-backed.
          </p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm"
          >
            Sign out
          </button>
        </form>
      </div>

      <div className="grid gap-4 rounded-lg border border-neutral-200 p-4 sm:grid-cols-2">
        <Field label="Provider" value={ctx.provider} />
        <Field label="Assurance" value={ctx.assuranceLevel} />
        <Field label="Tenant (company) id" value={ctx.tenantId} />
        <Field label="User id" value={ctx.userId} />
        <Field label="Membership id" value={ctx.membershipId} />
        <Field label="Role id" value={ctx.roleId} />
        <Field label="Session context id" value={ctx.sessionContextId} />
        <Field label="Authenticated at" value={ctx.authenticatedAt} />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Persistence status
        </h2>
        <p className="text-sm">
          {durable ? (
            <span className="font-medium text-green-700">
              DURABLE — Postgres (local control plane); registries persist across
              restart and are isolated by tenant_id.
            </span>
          ) : (
            <span className="font-medium text-amber-700">
              NOT CONFIGURED — durable registry persistence is unavailable; the
              slice fails closed rather than using memory.
            </span>
          )}
        </p>
        {durableError ? (
          <p className="text-sm text-red-700">{durableError}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Tenant registries ({registries.length})
        </h2>
        {registries.length === 0 ? (
          <p className="text-sm text-neutral-500">
            No durable registries for this tenant yet.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200 rounded-lg border border-neutral-200">
            {registries.map((registry) => (
              <li
                key={registry.id}
                className="flex items-center justify-between gap-4 px-4 py-2 text-sm"
              >
                <span className="font-medium">{registry.title}</span>
                <span className="font-mono text-xs text-neutral-500">
                  {registry.id} · {registry.lifecycleStatus}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {durable ? (
        <form
          action={createFoundationRegistryAction}
          className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4"
        >
          <h2 className="text-sm font-semibold">Create a durable registry</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>Slug</span>
              <input
                name="slug"
                required
                placeholder="finance"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>Title</span>
              <input
                name="title"
                required
                placeholder="Finance"
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span>Description</span>
            <input
              name="description"
              placeholder="Finance registry"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
          >
            Persist registry
          </button>
        </form>
      ) : null}
    </section>
  );
}
