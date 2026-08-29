import { PageHeader } from "@/components/layout/page-header";
import { LegacyDomainNotice } from "@/components/workforce-workspace/legacy-domain";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { learningPaths } from "@/features/hr/mock";

function certVariant(cert: string): BadgeVariant {
  if (cert === "Certified") return "success";
  if (cert === "In progress") return "primary";
  return "neutral";
}

export default function LearningPage() {
  const assigned = learningPaths.length;
  const certified = learningPaths.filter((l) => l.certification === "Certified").length;
  const avgProgress = Math.round(
    learningPaths.reduce((s, l) => s + l.progress, 0) / learningPaths.length
  );

  const stats = [
    { label: "Learning Paths", value: `${assigned}` },
    { label: "Certifications", value: `${certified}` },
    { label: "Avg Progress", value: `${avgProgress}%` },
  ];

  return (
    <>
      <PageHeader
        title="Learning Center"
        context="Learning paths assigned by the Learning & Development Agent."
      />

      <div className="mb-6">
        <LegacyDomainNotice domain="HR" />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {stats.map((s) => (
          <div key={s.label} className="col-span-12 sm:col-span-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-fg-secondary">
                  {s.label}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
              </CardContent>
            </Card>
          </div>
        ))}

        <div className="col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Assigned Trainings</CardTitle>
              <span className="text-xs text-fg-muted">path · progress · skill gap</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {learningPaths.map((l) => (
                <div key={l.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-fg">
                      {l.name}
                      <span className="ml-2 text-xs font-normal text-fg-muted">
                        {l.assignee}
                      </span>
                    </span>
                    <Badge variant={certVariant(l.certification)}>
                      {l.certification}
                    </Badge>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-(image:--gradient-primary)"
                      style={{ width: `${l.progress}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-fg-muted">
                    <span className="tabular-nums">{l.progress}% complete</span>
                    <span>Skill gap: {l.skillGap}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
