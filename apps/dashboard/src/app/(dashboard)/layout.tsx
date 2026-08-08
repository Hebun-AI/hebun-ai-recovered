import { HebunShell } from "@/components/layout/hebun-shell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <HebunShell>{children}</HebunShell>;
}
