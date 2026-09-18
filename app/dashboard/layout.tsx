import { AppShell } from "@/components/layout/AppShell";
import { requireWorkspacePage } from "@/lib/context/workspace";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await requireWorkspacePage();
  return (
    <AppShell title="Dashboard" workspace={workspace}>
      {children}
    </AppShell>
  );
}
