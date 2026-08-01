import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-fg">
      <Sidebar />
      <div className="min-w-0 lg:pl-(--sidebar-w)">
        <TopBar />
        <main className="mx-auto flex w-full min-w-0 max-w-[1800px] flex-col px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>
    </div>
  );
}
