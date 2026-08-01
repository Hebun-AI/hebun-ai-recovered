import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

export function WorkspaceCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div>
          <h2 className="text-base font-semibold leading-6 text-fg text-balance">{title}</h2>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
