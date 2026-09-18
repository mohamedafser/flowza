import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { PageContainer } from "@/components/layout/PageContainer";
import type { RestaurantWorkspace } from "@/lib/context/restaurant";

type AppShellProps = {
  children: React.ReactNode;
  title?: string;
  workspace?: RestaurantWorkspace | null;
};

export function AppShell({ children, title, workspace = null }: AppShellProps) {
  return (
    <div className="bg-muted/30 flex min-h-dvh w-full overflow-x-hidden">
      <Sidebar className="sticky top-0 hidden h-dvh lg:flex" />
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <Header title={title} workspace={workspace} />
        <main className="flex-1 overflow-x-hidden">
          <PageContainer>{children}</PageContainer>
        </main>
      </div>
    </div>
  );
}
