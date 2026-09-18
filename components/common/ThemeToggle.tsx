"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

type ThemeToggleProps = {
  className?: string;
  /** Icon menu for toolbars, or segmented control for settings. */
  variant?: "icon" | "segmented";
};

function subscribeNoop() {
  return () => {};
}

export function ThemeToggle({ className, variant = "icon" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const activeTheme = theme ?? "system";

  if (variant === "segmented") {
    return (
      <div
        role="radiogroup"
        aria-label="Color theme"
        className={cn(
          "border-border grid grid-cols-3 gap-1 rounded-lg border p-1",
          className,
        )}
      >
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = mounted && activeTheme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={!mounted}
              onClick={() => setTheme(value)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                selected
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id="theme-toggle-trigger"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          className,
        )}
        aria-label="Color theme"
      >
        <Sun className="size-4 dark:hidden" />
        <Moon className="hidden size-4 dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        <DropdownMenuRadioGroup
          value={mounted ? activeTheme : undefined}
          onValueChange={setTheme}
        >
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className="size-4" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
