import { AppShell } from "@/components/layout/AppShell";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { requireWorkspacePage } from "@/lib/context/workspace";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const workspace = await requireWorkspacePage();
  return (
    <AppShell title="Settings" workspace={workspace}>
      <div className="flex flex-col gap-8 lg:flex-row">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}
