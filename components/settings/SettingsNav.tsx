"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SETTINGS_BRANCHES_PATH,
  SETTINGS_CUSTOMER_PATH,
  SETTINGS_GENERAL_PATH,
  SETTINGS_HOURS_PATH,
  SETTINGS_PATH,
  SETTINGS_QUEUE_PATH,
  SETTINGS_TABLES_PATH,
} from "@/lib/auth/paths";
import { cn } from "@/lib/utils";

const SETTINGS_NAV = [
  { title: "Account", href: SETTINGS_PATH },
  { title: "General", href: SETTINGS_GENERAL_PATH },
  { title: "Branches", href: SETTINGS_BRANCHES_PATH },
  { title: "Operating Hours", href: SETTINGS_HOURS_PATH },
  { title: "Table Sections", href: SETTINGS_TABLES_PATH },
  { title: "Queue Settings", href: SETTINGS_QUEUE_PATH },
  { title: "Customer Experience", href: SETTINGS_CUSTOMER_PATH },
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
          const active =
            item.href === SETTINGS_PATH
              ? pathname === SETTINGS_PATH
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  "block rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-muted text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                {item.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
