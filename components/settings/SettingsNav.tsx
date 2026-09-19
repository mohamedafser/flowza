"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Building2,
  Clock3,
  LayoutGrid,
  ListOrdered,
  Settings2,
  UserRound,
  Users,
} from "lucide-react";
import {
  SETTINGS_BRANCHES_PATH,
  SETTINGS_CUSTOMER_PATH,
  SETTINGS_GENERAL_PATH,
  SETTINGS_HOURS_PATH,
  SETTINGS_NOTIFICATIONS_PATH,
  SETTINGS_PATH,
  SETTINGS_QUEUE_PATH,
  SETTINGS_TABLES_PATH,
} from "@/lib/auth/paths";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  { title: "Account", href: SETTINGS_PATH, icon: UserRound },
  { title: "General", href: SETTINGS_GENERAL_PATH, icon: Settings2 },
  { title: "Branches", href: SETTINGS_BRANCHES_PATH, icon: Building2 },
  { title: "Operating Hours", href: SETTINGS_HOURS_PATH, icon: Clock3 },
  { title: "Table Sections", href: SETTINGS_TABLES_PATH, icon: LayoutGrid },
  { title: "Queue Settings", href: SETTINGS_QUEUE_PATH, icon: ListOrdered },
  {
    title: "Customer Experience",
    href: SETTINGS_CUSTOMER_PATH,
    icon: Users,
  },
  {
    title: "Notifications",
    href: SETTINGS_NOTIFICATIONS_PATH,
    icon: Bell,
  },
] as const;

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings"
      className="lg:sticky lg:top-20 lg:w-52 lg:shrink-0"
    >
      <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {SETTINGS_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === SETTINGS_PATH
              ? pathname === SETTINGS_PATH
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
