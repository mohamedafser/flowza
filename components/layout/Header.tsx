import { MobileNav } from "@/components/layout/MobileNav";
import { AppLogo } from "@/components/common/AppLogo";
import { ConnectionIndicator } from "@/components/common/ConnectionIndicator";
import { InstallPWA } from "@/components/common/InstallPWA";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { BranchSwitcher } from "@/components/restaurant/BranchSwitcher";
import { RestaurantSwitcher } from "@/components/restaurant/RestaurantSwitcher";
import type { RestaurantWorkspace } from "@/lib/context/restaurant";

type HeaderProps = {
  title?: string;
  workspace?: RestaurantWorkspace | null;
};

export function Header({ title, workspace = null }: HeaderProps) {
  return (
    <header className="border-border bg-background/90 supports-backdrop-filter:bg-background/75 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur sm:gap-3">
      <MobileNav role={workspace?.role ?? null} />
      <div className="min-w-0 lg:hidden">
        <AppLogo />
      </div>
      {title ? (
        <h1 className="hidden max-w-[10rem] truncate text-sm font-semibold xl:block">
          {title}
        </h1>
      ) : null}
      {workspace?.restaurant ? (
        <div className="flex min-w-0 items-center gap-2">
          <RestaurantSwitcher
            memberships={workspace.memberships}
            currentRestaurantId={workspace.restaurant.id}
          />
          <BranchSwitcher
            branches={workspace.activeBranches}
            currentBranchId={workspace.branch?.id ?? null}
          />
        </div>
      ) : null}
      <div className="ml-auto flex items-center gap-2">
        <ConnectionIndicator />
        {workspace?.restaurant ? (
          <NotificationBell restaurantId={workspace.restaurant.id} />
        ) : null}
        <ThemeToggle />
        <InstallPWA compact />
        {workspace ? (
          <LogoutButton
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex"
          />
        ) : null}
      </div>
    </header>
  );
}
