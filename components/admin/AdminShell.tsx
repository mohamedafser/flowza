import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { LockBodyScroll } from "@/components/layout/LockBodyScroll";
import { PageContainer } from "@/components/layout/PageContainer";

type AdminShellProps = {
  children: React.ReactNode;
  title?: string;
  userEmail?: string | null;
  userName?: string | null;
};

export function AdminShell({
  children,
  title = "Platform Admin",
  userEmail,
  userName,
}: AdminShellProps) {
  return (
    <div className="bg-muted/30 fixed inset-0 flex overflow-hidden">
      <LockBodyScroll />
      <AdminSidebar className="hidden h-full lg:flex" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <AdminHeader
          title={title}
          userEmail={userEmail}
          userName={userName}
        />
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
