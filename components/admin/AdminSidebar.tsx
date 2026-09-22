"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  Layers,
  LayoutDashboard,
  ScrollText,
  Settings,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import { AppLogo } from "@/components/common/AppLogo";
import { ADMIN_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

const iconMap = {
  LayoutDashboard,
  Store,
  Users,
  CreditCard,
  Layers,
  Wallet,
  ScrollText,
  Settings,
} as const;

type AdminSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

export function AdminSidebar({ className, onNavigate }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "border-border bg-sidebar text-sidebar-foreground flex h-full min-h-0 w-64 shrink-0 flex-col overflow-hidden border-r",
        className,
      )}
    >
      <div className="border-sidebar-border flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <Link href="/admin" onClick={onNavigate} className="min-w-0">
          <AppLogo />
        </Link>
        <span className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
          Admin
        </span>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto p-3"
        aria-label="Platform admin"
      >
        <ul className="space-y-1">
          {ADMIN_NAV.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap];
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

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
