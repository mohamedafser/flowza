"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "@/components/layout/Sidebar";
import { APP_NAME } from "@/lib/constants";
import type { MemberRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type MobileNavProps = {
  role?: MemberRole | null;
};

export function MobileNav({ role = null }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        id="mobile-nav-trigger"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "lg:hidden",
        )}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-[18rem] p-0 sm:max-w-[18rem]">
        <SheetHeader className="sr-only">
          <SheetTitle>{APP_NAME} navigation</SheetTitle>
        </SheetHeader>
        <Sidebar
          className="w-full border-r-0"
          role={role}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
