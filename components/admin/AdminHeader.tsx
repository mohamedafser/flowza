"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AppLogo } from "@/components/common/AppLogo";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { InstallPWA } from "@/components/common/InstallPWA";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type AdminHeaderProps = {
  title?: string;
  userEmail?: string | null;
  userName?: string | null;
};

export function AdminHeader({
  title,
  userEmail,
  userName,
}: AdminHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-border bg-background/90 supports-backdrop-filter:bg-background/75 z-30 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur sm:gap-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "lg:hidden",
          )}
          aria-label="Open admin navigation"
        >
          <Menu className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-[18rem] p-0 sm:max-w-[18rem]">
          <SheetHeader className="sr-only">
            <SheetTitle>Admin navigation</SheetTitle>
          </SheetHeader>
          <AdminSidebar
            onNavigate={() => setOpen(false)}
            className="w-full border-r-0"
          />
        </SheetContent>
      </Sheet>

      <div className="min-w-0 lg:hidden">
        <AppLogo />
      </div>
      {title ? (
        <h1 className="hidden max-w-[14rem] truncate text-sm font-semibold xl:block">
          {title}
        </h1>
      ) : null}

      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="text-muted-foreground hidden min-w-0 text-right text-xs sm:block">
          <div className="text-foreground truncate font-medium">
            {userName || "Super Admin"}
          </div>
          {userEmail ? <div className="truncate">{userEmail}</div> : null}
        </div>
        <ThemeToggle />
        <InstallPWA compact />
        <LogoutButton
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex"
        />
      </div>
    </header>
  );
}
