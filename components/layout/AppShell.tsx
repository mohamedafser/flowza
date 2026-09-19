import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { PageContainer } from "@/components/layout/PageContainer";
import { LockBodyScroll } from "@/components/layout/LockBodyScroll";
import type { RestaurantWorkspace } from "@/lib/context/restaurant";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  workspace?: RestaurantWorkspace | null;
};

export function AppShell({ children, title, workspace = null }: AppShellProps) {
  return (
    <div className="bg-muted/30 fixed inset-0 flex overflow-hidden">
      <LockBodyScroll />
      <Sidebar
        className="hidden h-full lg:flex"
        role={workspace?.role ?? null}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header title={title} workspace={workspace} />
        <main
          data-app-shell-scroll
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
        >
          <PageContainer>{children}</PageContainer>
        </main>
      </div>
    </div>
  );
}
