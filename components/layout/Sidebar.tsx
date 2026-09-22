"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Calendar,
  LayoutDashboard,
  ListOrdered,
  Monitor,
  QrCode,
  Settings,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { AppLogo } from "@/components/common/AppLogo";
import { DASHBOARD_NAV } from "@/lib/constants";
import { filterNavByRole } from "@/lib/auth/navigation";
import type { MemberRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

const iconMap = {
  LayoutDashboard,
  ListOrdered,
  UtensilsCrossed,
  Users,
  Calendar,
  Monitor,
  QrCode,
  BarChart3,
  Settings,
} as const;

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
  role?: MemberRole | null;
};

export function Sidebar({ className, onNavigate, role = null }: SidebarProps) {
  const pathname = usePathname();
  const items = filterNavByRole(DASHBOARD_NAV, role);

  return (
    <aside
      className={cn(
        "border-border bg-sidebar text-sidebar-foreground flex h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r",
        className,
      )}
    >
      <div className="border-sidebar-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Link href="/dashboard" onClick={onNavigate} className="min-w-0">
          <AppLogo />
        </Link>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto p-3"
        aria-label="Dashboard"
      >
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap];
            const active =
              pathname === item.href ||
              (item.href !== "/settings" && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
                  )}
                >
                  {Icon ? <Icon className="size-4 shrink-0" /> : null}
                  <span className="truncate">{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
