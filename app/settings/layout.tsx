import { Suspense } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsSkeleton } from "@/components/common/PageSkeletons";
import { requireWorkspacePage } from "@/lib/context/workspace";

export const dynamic = "force-dynamic";

async function SettingsShell({ children }: { children: React.ReactNode }) {
  const workspace = await requireWorkspacePage();
  return (
    <AppShell title="Settings" workspace={workspace}>
      <div className="flex flex-col gap-8 lg:flex-row">
        <SettingsNav role={workspace.role} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AppShell>
  );
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <AppShell title="Settings" workspace={null}>
          <div className="flex flex-col gap-8 lg:flex-row">
            <SettingsNav />
            <div className="min-w-0 flex-1">
              <SettingsSkeleton />
            </div>
          </div>
        </AppShell>
      }
    >
      <SettingsShell>{children}</SettingsShell>
    </Suspense>
  );
}
