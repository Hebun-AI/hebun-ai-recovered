"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Plus } from "lucide-react";
import { Drawer } from "@/components/organization/drawer";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activeProvider, getPersistenceTelemetry } from "@/features/persistence";
import {
  archiveAgent,
  buildReport,
  createAgent,
  deleteAgent,
  getAuditLog,
  getCrudHistory,
  getSnapshot,
  restoreAgent,
  subscribe,
  updateAgent,
} from "@/features/agent-crud";
import { providerRecords } from "@/features/provider-framework/provider-registry";
import type { AgentCrudRecord, CreateAgentInput } from "@/features/agent-crud";
import type { LifecycleStatus } from "@/features/persistence";
import type { AgentStatus } from "@/types";

const lifecycleVariant: Record<LifecycleStatus, BadgeVariant> = {
  active: "success",
  archived: "warning",
  deleted: "error",
};

interface DrawerState {
  mode: "create" | "edit";
  record?: AgentCrudRecord;
}

interface FormState {
  name: string;
  slug: string;
  description: string;
  department: string;
  category: string;
  owner: string;
  status: AgentStatus;
  version: string;
  capabilities: string;
  provider: string;
  model: string;
  tools: string;
  permissions: string;
  runtime: string;
  memory: string;
  knowledge: string;
  role: string;
  tasksToday: string;
  costToday: string;
  lastActive: string;
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  department: "",
  category: "",
  owner: "",
  status: "idle",
  version: "v1.0.0",
  capabilities: "",
  provider: providerRecords[0]?.metadata.id ?? "",
  model: "gpt-5.4",
  tools: "",
  permissions: "",
  runtime: "simulation",
  memory: "",
  knowledge: "",
  role: "",
  tasksToday: "0",
  costToday: "0",
  lastActive: "just now",
};

const inputClass =
  "h-9 w-full rounded-md border bg-surface px-3 text-sm text-fg outline-none placeholder:text-fg-muted focus-visible:border-border-strong";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toForm(record: AgentCrudRecord): FormState {
  return {
    name: record.name,
    slug: record.slug,
    description: record.description,
    department: record.department,
    category: record.category,
    owner: record.owner,
    status: record.status,
    version: record.version,
    capabilities: record.capabilities.join(", "),
    provider: record.provider,
    model: record.model,
    tools: record.tools.join(", "),
    permissions: record.permissions.join(", "),
    runtime: record.runtime,
    memory: record.memory,
    knowledge: record.knowledge,
    role: record.role,
    tasksToday: String(record.tasksToday),
    costToday: String(record.costToday),
    lastActive: record.lastActive,
  };
}

function toInput(form: FormState): CreateAgentInput {
  return {
    name: form.name,
    slug: form.slug || slugify(form.name),
    description: form.description,
    department: form.department,
    category: form.category,
    owner: form.owner,
    status: form.status,
    version: form.version,
    capabilities: splitList(form.capabilities),
    provider: form.provider,
    model: form.model,
    tools: splitList(form.tools),
    permissions: splitList(form.permissions),
    runtime: form.runtime,
    memory: form.memory,
    knowledge: form.knowledge,
    role: form.role || form.category,
    tasksToday: Number(form.tasksToday) || 0,
    costToday: Number(form.costToday) || 0,
    lastActive: form.lastActive,
  };
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium uppercase tracking-wider text-fg-muted">{label}</label>
      {children}
    </div>
  );
}

export function AgentRegistryWorkspace() {
  const records = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const report = buildReport();
  const telemetry = report.telemetry;
  const history = getCrudHistory();
  const audit = getAuditLog();
  const persistence = getPersistenceTelemetry();

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [errors, setErrors] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [lifecycle, setLifecycle] = useState<"all" | LifecycleStatus>("all");
  const [mounted, setMounted] = useState(false);

  // Telemetry counters are client-session state; render them only after mount so
  // SSR and hydration agree with the seeded store snapshot.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      const matchesLifecycle = lifecycle === "all" || record.lifecycleStatus === lifecycle;
      const haystack = [
        record.id,
        record.name,
        record.slug,
        record.department,
        record.category,
        record.provider,
        record.model,
      ]
        .join(" ")
        .toLowerCase();
      return matchesLifecycle && haystack.includes(query.toLowerCase());
    });
  }, [lifecycle, query, records]);

  function openCreate() {
    setForm(emptyForm);
    setErrors([]);
    setDrawer({ mode: "create" });
  }

  function openEdit(record: AgentCrudRecord) {
    setForm(toForm(record));
    setErrors([]);
    setDrawer({ mode: "edit", record });
  }

  async function submit() {
    const input = toInput(form);
    const result = await (
      drawer?.mode === "edit" && drawer.record
        ? updateAgent(drawer.record.id, input)
        : createAgent(input)
    );

    if (result.ok) {
      setDrawer(null);
      setErrors([]);
      return;
    }

    setErrors(result.errors);
  }

  const show = (value: number | string) => (mounted ? value : "—");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Agent Registry Management</CardTitle>
            <span className="text-xs text-fg-muted">
              In-memory CRUD through the Command Bus · soft delete only
            </span>
          </div>
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus className="size-4" />
            Create Agent
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
            {[
              { label: "Active", value: report.active },
              { label: "Archived", value: report.archived },
              { label: "Deleted", value: report.deleted },
              { label: "Departments", value: report.departments },
              { label: "Creates", value: telemetry.creates },
              { label: "Updates", value: telemetry.updates },
              { label: "Restores", value: telemetry.restores },
              { label: "Soft Deletes", value: telemetry.softDeletes },
            ].map((metric) => (
              <div key={metric.label} className="rounded-md border bg-surface-sunken p-3">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {metric.label}
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums">{show(metric.value)}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agents"
              className={inputClass}
            />
            <select
              value={lifecycle}
              onChange={(event) => setLifecycle(event.target.value as "all" | LifecycleStatus)}
              className="h-9 rounded-md border bg-surface px-3 text-sm text-fg outline-none focus-visible:border-border-strong"
            >
              <option value="all">All lifecycle states</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          <div className="ui-table-wrap">
            <table className="w-full min-w-[1180px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-fg-muted">
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Department</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Provider</th>
                  <th className="px-4 py-3 font-medium">Model</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Lifecycle</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((record) => (
                  <tr key={record.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-fg">{record.name}</span>
                        <span className="font-mono text-xs text-fg-muted">
                          {record.id} · {record.slug}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-fg-secondary">{record.department}</td>
                    <td className="px-4 py-3 text-fg-secondary">{record.category}</td>
                    <td className="px-4 py-3 text-fg-secondary">{record.provider}</td>
                    <td className="px-4 py-3 text-fg-secondary">{record.model}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={lifecycleVariant[record.lifecycleStatus]}>
                        {record.lifecycleStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-fg-secondary">{record.owner}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {record.lifecycleStatus !== "deleted" && (
                          <Button variant="ghost" size="sm" onClick={() => openEdit(record)}>
                            Edit
                          </Button>
                        )}
                        {record.lifecycleStatus === "active" && (
                          <Button variant="outline" size="sm" onClick={() => void archiveAgent(record.id)}>
                            Archive
                          </Button>
                        )}
                        {record.lifecycleStatus !== "active" && (
                          <Button variant="outline" size="sm" onClick={() => void restoreAgent(record.id)}>
                            Restore
                          </Button>
                        )}
                        {record.lifecycleStatus !== "deleted" && (
                          <Button variant="danger" size="sm" onClick={() => void deleteAgent(record.id)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-fg-muted">
            {show(report.total)} agents · {show(report.historyCount)} commands · {show(report.auditCount)} audit
            records · avg {show(report.avgLatencyMs)}ms · {show(telemetry.validationFailures)} validation
            failures
          </p>
          <p className="text-xs text-fg-muted">
            Storage: {activeProvider()} adapter · {show(persistence.operations)} ops · {show(persistence.writes)}
            writes · {show(persistence.reads)} reads · {show(persistence.adapterLatencyMs)}ms adapter latency
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 xl:col-span-6">
          <CardHeader>
            <CardTitle>Command History</CardTitle>
            <span className="text-xs text-fg-muted">Newest first</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {history.slice(0, 8).map((entry) => (
              <div key={entry.commandId} className="rounded-md border bg-surface-sunken p-3 text-sm">
                <p className="font-medium text-fg">
                  {entry.action} · {entry.agentId}
                </p>
                <p className="text-xs text-fg-secondary">
                  {entry.commandId} · {entry.actor} · {entry.timestamp}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="col-span-12 xl:col-span-6">
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
            <span className="text-xs text-fg-muted">Command id, actor, previous state, new state</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {audit.slice(0, 8).map((entry) => (
              <div key={entry.commandId} className="rounded-md border bg-surface-sunken p-3 text-sm">
                <p className="font-medium text-fg">
                  {entry.action} · {entry.newState.name}
                </p>
                <p className="text-xs text-fg-secondary">
                  {entry.commandId} · {entry.actor} · {entry.timestamp}
                </p>
                <p className="mt-1 text-xs text-fg-muted">
                  {entry.previousState?.lifecycleStatus ?? "none"} → {entry.newState.lifecycleStatus} · simulation{" "}
                  {String(entry.simulation)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Drawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        title={drawer?.mode === "edit" ? "Edit Agent" : "Create Agent"}
        subtitle={drawer?.mode === "edit" ? "Command · agent.update" : "Command · agent.create"}
      >
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name">
              <input
                className={inputClass}
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                    slug:
                      drawer?.mode === "create" || current.slug === slugify(current.name)
                        ? slugify(event.target.value)
                        : current.slug,
                  }))
                }
                placeholder="Agent name"
              />
            </FormField>
            <FormField label="Slug">
              <input
                className={inputClass}
                value={form.slug}
                onChange={(event) => setForm({ ...form, slug: event.target.value })}
                placeholder="agent-slug"
              />
            </FormField>
            <FormField label="Department">
              <input
                className={inputClass}
                value={form.department}
                onChange={(event) => setForm({ ...form, department: event.target.value })}
                placeholder="Sales"
              />
            </FormField>
            <FormField label="Owner">
              <input
                className={inputClass}
                value={form.owner}
                onChange={(event) => setForm({ ...form, owner: event.target.value })}
                placeholder="Sales"
              />
            </FormField>
            <FormField label="Category">
              <input
                className={inputClass}
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                placeholder="Deal Execution"
              />
            </FormField>
            <FormField label="Role">
              <input
                className={inputClass}
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                placeholder="Deal Execution"
              />
            </FormField>
            <FormField label="Status">
              <select
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as AgentStatus })}
                className="h-9 rounded-md border bg-surface px-3 text-sm text-fg outline-none focus-visible:border-border-strong"
              >
                <option value="running">Running</option>
                <option value="idle">Idle</option>
                <option value="paused">Paused</option>
                <option value="error">Error</option>
              </select>
            </FormField>
            <FormField label="Version">
              <input
                className={inputClass}
                value={form.version}
                onChange={(event) => setForm({ ...form, version: event.target.value })}
                placeholder="v1.0.0"
              />
            </FormField>
            <FormField label="Provider">
              <select
                value={form.provider}
                onChange={(event) => setForm({ ...form, provider: event.target.value })}
                className="h-9 rounded-md border bg-surface px-3 text-sm text-fg outline-none focus-visible:border-border-strong"
              >
                {providerRecords.map((provider) => (
                  <option key={provider.metadata.id} value={provider.metadata.id}>
                    {provider.metadata.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Model">
              <input
                className={inputClass}
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                placeholder="gpt-5.4"
              />
            </FormField>
            <FormField label="Runtime">
              <input
                className={inputClass}
                value={form.runtime}
                onChange={(event) => setForm({ ...form, runtime: event.target.value })}
                placeholder="simulation"
              />
            </FormField>
            <FormField label="Memory">
              <input
                className={inputClass}
                value={form.memory}
                onChange={(event) => setForm({ ...form, memory: event.target.value })}
                placeholder="Working memory"
              />
            </FormField>
            {/*
             * UI Phase 25B — Tasks Today / Cost Today / Last Active inputs removed from the
             * definition form. They are seeded ACTIVITY, not definition attributes, and must not
             * be presented (even as editable fields) as organizational truth. New definitions keep
             * the record defaults (0 / 0 / "just now"); edits preserve existing values untouched.
             */}
          </div>

          <FormField label="Description">
            <textarea
              className="min-h-24 w-full rounded-md border bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-fg-muted focus-visible:border-border-strong"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Describe the agent and its purpose"
            />
          </FormField>
          <FormField label="Capabilities">
            <input
              className={inputClass}
              value={form.capabilities}
              onChange={(event) => setForm({ ...form, capabilities: event.target.value })}
              placeholder="capability one, capability two"
            />
          </FormField>
          <FormField label="Tools">
            <input
              className={inputClass}
              value={form.tools}
              onChange={(event) => setForm({ ...form, tools: event.target.value })}
              placeholder="browser, terminal"
            />
          </FormField>
          <FormField label="Permissions">
            <input
              className={inputClass}
              value={form.permissions}
              onChange={(event) => setForm({ ...form, permissions: event.target.value })}
              placeholder="agent.read, workflow.execute"
            />
          </FormField>
          <FormField label="Knowledge">
            <input
              className={inputClass}
              value={form.knowledge}
              onChange={(event) => setForm({ ...form, knowledge: event.target.value })}
              placeholder="Knowledge scope"
            />
          </FormField>
          {errors.length > 0 && (
            <div className="flex flex-col gap-1 rounded-md border border-error/30 bg-error-subtle p-3">
              {errors.map((error, index) => (
                <p key={index} className="text-sm text-error">
                  {error}
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-4">
            <Button variant="primary" onClick={submit} className="w-full justify-center">
              {drawer?.mode === "edit" ? "Save changes" : "Create agent"}
            </Button>
            <p className="text-xs leading-5 text-fg-muted">
              Runs through the Command Bus and mutates the in-memory store. Deterministic, offline,
              no runtime or database writes.
            </p>
          </div>
        </div>
      </Drawer>
    </div>
  );
}
